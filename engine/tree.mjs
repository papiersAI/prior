// The idea tree: recursive, best-first exploration over idea space, seeded by
// the researcher's curation. Root = objective; seeds = their objective-relevant
// unread saves; level 1 = ideas generated from the seeds; then a loop — pick
// the most promising frontier idea, dispatch a deep-dive agent (targeted
// search → evaluate → refine into sub-ideas), score, prune, repeat. The UI
// renders the whole exploration live; a brief distills the tree at the end.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { completeJSON } from './llm.mjs';
import { exaSearch } from './exa.mjs';
import { scout } from './scout.mjs';
import { REPO_ROOT } from './env.mjs';

const RECEIPT = {
  type: 'object',
  additionalProperties: false,
  properties: { ref: { type: 'string' }, quote: { type: 'string' } },
  required: ['ref', 'quote'],
};

const IDEA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    approach: { type: 'string' },
    ev: { type: 'integer' }, // 1-10 expected value for the objective
    receipts: { type: 'array', items: RECEIPT },
  },
  required: ['title', 'approach', 'ev', 'receipts'],
};

const ROOT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: { ideas: { type: 'array', items: IDEA } },
  required: ['ideas'],
};

const EXPAND_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    evaluation: {
      type: 'object',
      additionalProperties: false,
      properties: {
        score: { type: 'integer' }, // 1-10 post-deep-dive expected value
        verdict: { type: 'string' },
        risks: { type: 'string' },
      },
      required: ['score', 'verdict', 'risks'],
    },
    children: { type: 'array', items: IDEA }, // 0-3 refinements/variants
  },
  required: ['evaluation', 'children'],
};

function baseSystem(prior, objective) {
  return `You are one step of a recursive idea-exploration tree for a research objective. The tree is seeded by a specific human researcher's curation — their prior and their unread saves (a save is a judgment event: someone they trust surfaced it, their instinct flagged it). Ideas must be mechanism-level and specific to the objective; every idea cites receipts (seed ids like [doc_…]/[hl_…], or source urls) when material genuinely contributed — empty receipts are honest when it didn't. Never fabricate receipts. Expected value (ev, 1-10) is your honest estimate of the idea's value toward the objective, considering both upside and feasibility.

OBJECTIVE:
${objective}

=== THE RESEARCHER'S PRIOR ===
${prior}
=== END PRIOR ===`;
}

export async function explore({ taskSpec, taskTitle, getPrior, expansions = 6, saves = 12, scoutRounds = 2, emit, search = exaSearch }) {
  let nid = 0;
  const nodes = new Map();
  const node = (props) => {
    const n = { id: `t${++nid}`, parentId: null, receipts: [], ...props };
    nodes.set(n.id, n);
    emit({ t: 'node', run: 'tree', step: 0, node: n });
    return n;
  };
  const update = (n, patch) => {
    Object.assign(n, patch);
    emit({ t: 'update', nodeId: n.id, score: n.score, status: n.status });
  };

  const root = node({ kind: 'root', text: taskTitle });

  // Seeds + initial signals via the scout (ring 0 + a light web pass).
  const found = await scout({ objective: taskSpec, getPrior, rounds: scoutRounds, emit, search, libraryMax: saves });
  for (const e of found.ring0) {
    node({ kind: 'seed', parentId: root.id, text: e.title.slice(0, 90), url: e.id });
  }

  // Level 1: root ideas from prior + seeds + signals.
  emit({ t: 'status', run: 'system', text: 'generating root ideas from the seed set…' });
  const ring0Block = found.ring0.map((e) => `--- ${e.id}: ${e.title}\n${e.text.slice(0, 1500)}`).join('\n\n');
  const signalsBlock = found.signals.map((s) => `- ${s.title} <${s.url}>: ${s.insight}`).join('\n');
  const rootGen = await completeJSON({
    system: baseSystem(getPrior(), taskSpec),
    user: `=== UNREAD SAVES, NOW READ ===\n${ring0Block}\n\n=== SCOUTED SIGNALS ===\n${signalsBlock}\n\nGenerate 5-6 distinct root ideas for the objective (breadth over depth — they will be recursively deepened later). Rank implicitly via honest ev.`,
    schema: ROOT_SCHEMA,
    maxTokens: 10000,
    effort: 'high',
  });
  for (const idea of rootGen.ideas.slice(0, 6)) {
    node({
      kind: 'idea', parentId: root.id, text: idea.title, detail: idea.approach,
      score: idea.ev, receipts: idea.receipts, status: 'frontier', depth: 1,
    });
  }

  // Best-first loop: expand the most promising frontier idea.
  for (let step = 1; step <= expansions; step++) {
    const frontier = [...nodes.values()].filter((n) => n.kind === 'idea' && n.status === 'frontier');
    if (!frontier.length) break;
    frontier.sort((a, b) => (b.score - a.score) || (a.depth - b.depth));
    const target = frontier[0];
    update(target, { status: 'expanding' });
    emit({ t: 'status', run: 'system', text: `expansion ${step}/${expansions}: deep-diving "${target.text.slice(0, 70)}"` });

    // Deep-dive agent: targeted evidence gathering, then evaluate + refine.
    const evidence = [];
    for (const q of [target.text, `${target.text} limitations state of the art`]) {
      const results = await search(`${q}`, { numResults: 3 });
      for (const r of results.slice(0, 3)) {
        evidence.push(r);
        node({ kind: 'evidence', parentId: target.id, text: r.title.slice(0, 80), url: r.url });
      }
    }
    const lineage = [];
    for (let p = nodes.get(target.parentId); p && p.kind === 'idea'; p = nodes.get(p.parentId)) {
      lineage.unshift(`${p.text}: ${p.detail}`);
    }
    const siblings = [...nodes.values()]
      .filter((n) => n.kind === 'idea' && n.id !== target.id)
      .map((n) => `- [${n.status}${n.score ? `, ev ${n.score}` : ''}] ${n.text}`)
      .join('\n');
    const out = await completeJSON({
      system: baseSystem(getPrior(), taskSpec),
      user: `DEEP-DIVE TARGET IDEA:\n${target.text}\n${target.detail}\n(receipts so far: ${target.receipts.map((r) => r.ref).join(', ') || 'none'})\n${lineage.length ? `\nLINEAGE (ancestors): ${lineage.join(' → ')}` : ''}\n\nFRESH EVIDENCE:\n${evidence.map((r) => `- ${r.title} <${r.url}> — ${r.snippet}`).join('\n')}\n\nREST OF THE TREE (avoid duplicating):\n${siblings}\n\n1. EVALUATE the target against the objective given the evidence — score by OPPORTUNITY COST: would a strong competitor spend their next hour on THIS rather than the best alternative in the tree? 8-10 = clearly yes; 5-7 = maybe; <=4 = no, the evidence weakens it or a sibling dominates it — prune. Honest score distributions have spread; a tree where nothing prunes means the evaluator failed, not that every idea is good. One-paragraph verdict, key risks.\n2. REFINE: 0-3 children — sharper variants, sub-approaches, or hybrids the deep-dive suggests. Children must be more specific than the parent, not restatements. Cite evidence urls and/or seed ids as receipts.`,
      schema: EXPAND_SCHEMA,
      maxTokens: 8000,
      effort: 'high',
    });

    node({ kind: 'eval', parentId: target.id, text: out.evaluation.verdict.slice(0, 220), detail: out.evaluation.risks });
    update(target, { score: out.evaluation.score, status: out.evaluation.score <= 4 ? 'pruned' : 'expanded' });
    if (out.evaluation.score > 4) {
      for (const child of out.children.slice(0, 3)) {
        node({
          kind: 'idea', parentId: target.id, text: child.title, detail: child.approach,
          score: child.ev, receipts: child.receipts, status: 'frontier', depth: (target.depth || 1) + 1,
        });
      }
    }
  }

  // Distill: the tree's best lineages as a brief.
  emit({ t: 'status', run: 'system', text: 'distilling the brief from the tree…' });
  const ranked = [...nodes.values()]
    .filter((n) => n.kind === 'idea' && n.status !== 'pruned')
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
  const md = renderTreeBrief({ taskTitle, ranked, nodes, found });
  mkdirSync(join(REPO_ROOT, 'briefs'), { recursive: true });
  const slug = taskTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);
  const outPath = join(REPO_ROOT, 'briefs', `tree-${slug}.md`);
  writeFileSync(outPath, md);
  emit({ t: 'brief', markdown: md });
  return { nodes: [...nodes.values()], ranked, outPath };
}

function renderTreeBrief({ taskTitle, ranked, nodes, found }) {
  const lines = [];
  lines.push(`# Exploration Brief — ${taskTitle}`);
  lines.push('');
  lines.push(`> Distilled from a recursive idea tree seeded by your curation: ${found.ring0.length} unread saves read, ${found.signals.length} signals scouted, ${[...nodes.values()].filter((n) => n.kind === 'idea').length} ideas explored (${[...nodes.values()].filter((n) => n.status === 'pruned').length} pruned). Every idea carries receipts back into your library or to discovered sources.`);
  lines.push('');
  ranked.forEach((n, i) => {
    const chain = [];
    for (let p = nodes.get(n.parentId); p && p.kind === 'idea'; p = nodes.get(p.parentId)) chain.unshift(p.text);
    lines.push(`## ${i + 1}. ${n.text} · score ${n.score}/10`);
    lines.push('');
    if (chain.length) lines.push(`*Lineage: ${chain.join(' → ')} → this*`);
    lines.push('');
    lines.push(n.detail || '');
    const evalNode = [...nodes.values()].find((x) => x.kind === 'eval' && x.parentId === n.id);
    if (evalNode) {
      lines.push('');
      lines.push(`**Deep-dive verdict.** ${evalNode.text}${evalNode.detail ? ` Risks: ${evalNode.detail}` : ''}`);
    }
    if (n.receipts?.length) {
      lines.push('');
      lines.push(`**Receipts:** ${n.receipts.map((r) => `[${r.ref}] ("${(r.quote || '').slice(0, 80)}")`).join('; ')}`);
    }
    lines.push('');
  });
  return lines.join('\n');
}
