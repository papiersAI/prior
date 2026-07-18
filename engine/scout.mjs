// The scout: seeded fan-out discovery. Takes the researcher's prior (the seed)
// plus an objective, and recursively explores outward via Exa — each round it
// harvests signals (sources that contribute a usable idea to the objective) and
// proposes deeper queries based on what it just found. Every signal carries
// provenance: which seed lines sent the scout in that direction.
import { completeJSON } from './llm.mjs';
import { exaSearch } from './exa.mjs';

const RECEIPT = {
  type: 'object',
  additionalProperties: false,
  properties: { ref: { type: 'string' }, quote: { type: 'string' } },
  required: ['ref', 'quote'],
};

const SCOUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    signals: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          url: { type: 'string' },
          title: { type: 'string' },
          insight: { type: 'string' },
          receipts: { type: 'array', items: RECEIPT },
        },
        required: ['url', 'title', 'insight', 'receipts'],
      },
    },
    queries: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          q: { type: 'string' },
          receipts: { type: 'array', items: RECEIPT },
        },
        required: ['q', 'receipts'],
      },
    },
  },
  required: ['signals', 'queries'],
};

const ARSENAL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    techniques: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          family: { type: 'string' },
          technique: { type: 'string' },
          when: { type: 'string' },
          sources: { type: 'array', items: { type: 'string' } },
          receipts: { type: 'array', items: RECEIPT },
        },
        required: ['family', 'technique', 'when', 'sources', 'receipts'],
      },
    },
  },
  required: ['techniques'],
};

function scoutSystem(prior, objective) {
  return `You are a scout for an autonomous research process: an alpha-seeking explorer. OBJECTIVE: ${objective}

You work outward from a specific human researcher's taste. Their prior (compiled from what they actually read, saved, highlighted, argued about) is your SEED — the researcher is NOT a domain expert in the objective; your job is to bridge from what they care about to the frontier of what the objective needs. Some search results may be the researcher's OWN UNREAD SAVES (title prefixed "[your unread save]", url is a doc_… library id): they saved these as promising and never got to them — you are reading their backlog for them. Treat these as the highest-trust signal tier; cite them with ref = the doc_… id. Each round: (1) HARVEST — from the latest search results, identify sources that contribute a concrete, usable idea toward the objective; for each, state the insight in one sentence and cite which seed lines sent you in this direction (ref = [hl_…]/[cnv_…]/[doc_…] id or short verbatim fragment; quote = the prior line). (2) FAN OUT — propose up to 3 deeper queries: follow leads in the results, seek adjacent techniques, chase named methods/papers/authors you just discovered. Recursive adjacency beats breadth. Never fabricate receipts; a signal with no genuine seed connection gets an empty receipts array (that is honest and allowed).

=== THE SEED (PRIOR.md) ===
${prior}
=== END SEED ===`;
}

export async function scout({ objective, getPrior, rounds = 3, emit, search = exaSearch, library = true }) {
  const state = { nid: 0, signals: [], lastResults: [], queriesRun: new Set() };
  const node = (props) => {
    const n = { id: `prior-s${++state.nid}`, parentId: null, receipts: [], ...props };
    emit({ t: 'node', run: 'prior', step: 0, node: n });
    return n;
  };

  // Ring 0: the researcher's own library — mine the unread backlog before the web.
  if (library) {
    try {
      const { listAllDocs, selectBacklog, readDocs } = await import('./library.mjs');
      emit({ t: 'status', run: 'system', text: 'scout ring 0: scanning the library backlog…' });
      const docs = listAllDocs();
      const unread = docs.filter((d) => !d.engaged).length;
      emit({ t: 'status', run: 'prior', text: `library: ${docs.length} items, ${unread} unread saves` });
      const ids = await selectBacklog(objective, docs, { max: 8 });
      const excerpts = readDocs(ids);
      for (const e of excerpts) {
        node({ kind: 'result', text: `📚 unread save: ${e.title.slice(0, 100)}`, url: e.id });
        state.lastResults.push({
          title: `[your unread save] ${e.title.slice(0, 100)}`,
          url: e.id,
          snippet: e.text.slice(0, 1200),
        });
      }
      emit({ t: 'status', run: 'prior', text: `ring 0: reading ${excerpts.length} unread saves from the backlog` });
    } catch (e) {
      process.stderr.write(`  warn: library ring failed (${e.message}); continuing with web only\n`);
    }
  }

  for (let round = 1; round <= rounds; round++) {
    emit({ t: 'status', run: 'system', text: `scout round ${round}/${rounds}` });
    const results = state.lastResults
      .map((r) => `- ${r.title} <${r.url}> — ${r.snippet}`)
      .join('\n') || '(none yet — first round: derive queries from the seed × objective)';
    const signalsSoFar = state.signals.map((s) => `- ${s.title}: ${s.insight}`).join('\n') || '(none yet)';
    const out = await completeJSON({
      system: scoutSystem(getPrior(), objective),
      user: `SIGNALS HARVESTED SO FAR:\n${signalsSoFar}\n\nQUERIES ALREADY RUN: ${[...state.queriesRun].join(' | ') || '(none)'}\n\nLATEST SEARCH RESULTS:\n${results}\n\nEmit this round's harvest and queries.`,
      schema: SCOUT_SCHEMA,
      effort: 'low',
    });
    for (const s of out.signals || []) {
      state.signals.push(s);
      node({ kind: 'note', text: `◆ signal: ${s.title} — ${s.insight}`, url: s.url, receipts: s.receipts });
    }
    state.lastResults = [];
    for (const q of (out.queries || []).slice(0, 3)) {
      if (state.queriesRun.has(q.q)) continue;
      state.queriesRun.add(q.q);
      const qNode = node({ kind: 'query', text: q.q, receipts: q.receipts });
      emit({ t: 'status', run: 'prior', text: `exa: ${q.q}` });
      const found = await search(q.q, { numResults: 3 });
      for (const r of found) {
        node({ kind: 'result', text: r.title, url: r.url, parentId: qNode.id });
        state.lastResults.push(r);
      }
    }
  }

  // Final harvest of the last round's results, then distill the arsenal.
  emit({ t: 'status', run: 'system', text: 'distilling idea arsenal from signals…' });
  const arsenal = await completeJSON({
    system: scoutSystem(getPrior(), objective),
    user: `ALL HARVESTED SIGNALS:\n${state.signals.map((s) => `- ${s.title} <${s.url}>: ${s.insight} [seeds: ${s.receipts.map((r) => r.ref).join(', ') || 'none'}]`).join('\n')}\n\nFINAL UNHARVESTED RESULTS (harvest anything useful from these too):\n${state.lastResults.map((r) => `- ${r.title} <${r.url}> — ${r.snippet}`).join('\n') || '(none)'}\n\nDistill the complete IDEA ARSENAL for the objective: concrete candidate techniques an experiment loop should try. For each — family (one word), technique (one line, specific), when (one line: when to reach for it), sources (urls from the signals that contribute it), receipts (seed lines that led here, chained through the signals). Rank by expected value for the objective.`,
    schema: ARSENAL_SCHEMA,
    effort: 'low',
  });
  for (const t of arsenal.techniques) {
    node({ kind: 'direction', text: `arsenal: ${t.technique} (${t.family})`, receipts: t.receipts });
  }
  return { signals: state.signals, techniques: arsenal.techniques };
}

export function arsenalBlock(techniques) {
  return techniques
    .map((t, i) =>
      `${i + 1}. [${t.family}] ${t.technique} — when: ${t.when}\n   sources: ${t.sources.join(', ') || '(model knowledge)'}\n   seed receipts: ${t.receipts.map((r) => `${r.ref} ("${r.quote.slice(0, 80)}")`).join('; ') || '(none)'}`
    )
    .join('\n');
}
