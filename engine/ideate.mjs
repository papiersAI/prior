// The counterfactual learned self. "If I had actually mastered everything I
// saved about this domain — and kept following the thread outward — what ideas
// could I generate for this task?" The scout does the learning journey (reads
// the unread backlog, fans out to the frontier); the synthesis speaks as the
// researcher-who-did-the-reading: ranked, mechanism-level ideas for the task,
// each grounded in the corpus, each with the reading path that builds the
// mastery behind it — the researcher's own saves first.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { completeJSON } from './llm.mjs';
import { scout } from './scout.mjs';
import { REPO_ROOT } from './env.mjs';

const RECEIPT = {
  type: 'object',
  additionalProperties: false,
  properties: { ref: { type: 'string' }, quote: { type: 'string' } },
  required: ['ref', 'quote'],
};

const BRIEF_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    framing: { type: 'string' },
    ideas: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          approach: { type: 'string' },
          why_it_fits: { type: 'string' },
          confidence: { type: 'string', enum: ['speculative', 'promising', 'strong'] },
          seeds: { type: 'array', items: RECEIPT },
          discovered: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: { url: { type: 'string' }, title: { type: 'string' } },
              required: ['url', 'title'],
            },
          },
          learning_path: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: { resource: { type: 'string' }, why: { type: 'string' } },
              required: ['resource', 'why'],
            },
          },
        },
        required: ['title', 'approach', 'why_it_fits', 'confidence', 'seeds', 'discovered', 'learning_path'],
      },
    },
  },
  required: ['framing', 'ideas'],
};

export async function ideate({ taskSpec, taskTitle, getPrior, rounds = 3, saves = 14, emit }) {
  emit({ t: 'status', run: 'system', text: 'learning journey: scouting the backlog and the frontier…' });
  const found = await scout({
    objective: taskSpec,
    getPrior,
    rounds,
    emit,
    libraryMax: saves,
  });

  emit({ t: 'status', run: 'system', text: 'synthesizing the idea brief (counterfactual learned self)…' });
  const ring0Block = found.ring0
    .map((e) => `--- ${e.id}: ${e.title}\n${e.text.slice(0, 2000)}`)
    .join('\n\n') || '(no backlog items were read)';
  const signalsBlock = found.signals
    .map((s) => `- ${s.title} <${s.url}>: ${s.insight}`)
    .join('\n') || '(none)';

  const brief = await completeJSON({
    system: `You are the researcher's counterfactual learned self: the version of them who actually completed the learning journey they aspired to when they saved these materials — and who kept following the thread outward to the frontier. You have just done that reading (their unread saves, below in full excerpt, plus the scouted signals). Now generate the ideas THAT person could produce for the task.

TASK SPEC:
${taskSpec}

REQUIREMENTS:
- 5-7 ideas, ranked by expected value. Mechanism-level specificity — algorithm and data-movement decisions, not vibes.
- Shape-aware: the benchmark grid has distinct regimes (e.g. thousands of tiny matrices vs a single huge one); say explicitly which regime each idea targets and why.
- Grounded: every idea names its corpus anchors — seeds = the researcher's own saves (ref = doc_/hl_ id, quote = the relevant line/insight), discovered = scouted sources. An idea with no anchor is either cut or marked confidence: speculative with empty seeds (honest is allowed; fabricated is not).
- Honest confidence tiers: strong (the corpus directly supports the mechanism), promising (corpus-adjacent, mechanism plausible), speculative (an extrapolation).
- LEARNING PATH per idea: the reading order that builds the mastery behind it — the researcher's OWN saves first (they chose them; they're trusted anchors), then discovered material. Resource = the save title + id, or source title + url. "Why" = what capability that reading builds toward this idea.
- The researcher may or may not be expert here. No condescension, no filler, no generic advice that a person without this corpus would equally produce.`,
    user: `THE RESEARCHER'S PRIOR:\n${getPrior()}\n\n=== THEIR UNREAD SAVES, NOW READ (ring 0) ===\n${ring0Block}\n\n=== SCOUTED SIGNALS ===\n${signalsBlock}\n\nProduce the idea brief.`,
    schema: BRIEF_SCHEMA,
    maxTokens: 16000,
    effort: 'high',
  });

  const md = renderBrief({ brief, taskTitle, found });
  mkdirSync(join(REPO_ROOT, 'briefs'), { recursive: true });
  const slug = taskTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);
  const outPath = join(REPO_ROOT, 'briefs', `${slug}.md`);
  writeFileSync(outPath, md);
  emit({ t: 'brief', markdown: md });
  return { brief, markdown: md, outPath, found };
}

function renderBrief({ brief, taskTitle, found }) {
  const lines = [];
  lines.push(`# Idea Brief — ${taskTitle}`);
  lines.push('');
  lines.push(`> Generated by your counterfactual learned self: ${found.ring0.length} of your unread saves read, ${found.signals.length} signals scouted outward from them. Every idea is anchored — seeds are your own saves (\`papiers read <id>\`), discoveries are linked.`);
  lines.push('');
  lines.push(brief.framing);
  lines.push('');
  brief.ideas.forEach((idea, i) => {
    lines.push(`## ${i + 1}. ${idea.title} · ${idea.confidence}`);
    lines.push('');
    lines.push(`**Approach.** ${idea.approach}`);
    lines.push('');
    lines.push(`**Why it fits.** ${idea.why_it_fits}`);
    lines.push('');
    if (idea.seeds.length) {
      lines.push(`**Seeded by your saves:** ${idea.seeds.map((s) => `[${s.ref}] ("${s.quote.slice(0, 90)}")`).join('; ')}`);
    }
    if (idea.discovered.length) {
      lines.push(`**Discovered en route:** ${idea.discovered.map((d) => `[${d.title}](${d.url})`).join('; ')}`);
    }
    if (idea.learning_path.length) {
      lines.push('');
      lines.push(`**Your learning path:**`);
      idea.learning_path.forEach((step, j) => {
        lines.push(`${j + 1}. ${step.resource} — ${step.why}`);
      });
    }
    lines.push('');
  });
  return lines.join('\n');
}

export async function cliIdeate(args) {
  const target = args.find((a) => !a.startsWith('--'));
  if (!target) {
    process.stderr.write('usage: prior ideate <task-file-or-text> [--rounds 3] [--saves 14] [--prior PRIOR.md]\n');
    process.exit(1);
  }
  const flag = (name, dflt) => {
    const i = args.indexOf(name);
    return i > -1 ? Number(args[i + 1]) : dflt;
  };
  const priorFlag = args.indexOf('--prior');
  const priorPath = resolve(priorFlag > -1 ? args[priorFlag + 1] : 'PRIOR.md');
  const getPrior = () => readFileSync(priorPath, 'utf8');

  let taskSpec = target;
  let taskTitle = target.slice(0, 80);
  if (existsSync(resolve(target))) {
    taskSpec = readFileSync(resolve(target), 'utf8');
    taskTitle = taskSpec.split('\n')[0].replace(/^#+\s*/, '');
  }

  const emit = (ev) => {
    process.stdout.write(JSON.stringify(ev) + '\n');
    if (ev.t === 'node') {
      const r = ev.node.receipts?.length ? `  [${ev.node.receipts.map((x) => x.ref).join(', ')}]` : '';
      process.stderr.write(`  ${ev.node.kind.padEnd(9)} ${ev.node.text.slice(0, 110)}${r}\n`);
    } else if (ev.t === 'status') {
      process.stderr.write(`── ${ev.text} ──\n`);
    }
  };

  const res = await ideate({
    taskSpec, taskTitle, getPrior,
    rounds: flag('--rounds', 3), saves: flag('--saves', 14), emit,
  });
  process.stderr.write(`\nbrief written: ${res.outPath} (${res.brief.ideas.length} ideas)\n`);
}
