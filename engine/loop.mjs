// The autoresearch loop, with the prior injected at defined points:
//   init    — PRIOR.md goes into the step system prompt (the program.md slot)
//   scoring — directions/queries cite the exact prior line that steered them
//   pruning — an aversion in the prior kills a matching live branch, with receipt
//   write-back — the run ends with "questions for the morning"
// The prior is re-read every step (getPrior), so a live edit takes effect on the
// next step. The vanilla run is the control: same code, prior = null.
import { completeJSON } from './llm.mjs';
import { exaSearch } from './exa.mjs';

const STEP_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    directions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          text: { type: 'string' },
          receipts: { type: 'array', items: RECEIPT() },
        },
        required: ['text', 'receipts'],
      },
    },
    queries: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          q: { type: 'string' },
          receipts: { type: 'array', items: RECEIPT() },
        },
        required: ['q', 'receipts'],
      },
    },
    prunes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          direction: { type: 'string' },
          reason: { type: 'string' },
          receipts: { type: 'array', items: RECEIPT() },
        },
        required: ['direction', 'reason', 'receipts'],
      },
    },
  },
  required: ['directions', 'queries', 'prunes'],
};

const MORNING_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: { questions: { type: 'array', items: { type: 'string' } } },
  required: ['questions'],
};

function RECEIPT() {
  return {
    type: 'object',
    additionalProperties: false,
    properties: { ref: { type: 'string' }, quote: { type: 'string' } },
    required: ['ref', 'quote'],
  };
}

function systemPrompt(prior) {
  const base = `You are one step of an autonomous research loop exploring a question via web search (Exa). Each step you: reflect on results so far, commit to the most promising directions, and emit the next search queries. Be specific and non-generic — every query should be one a strong researcher would actually run next. At most 2 new directions and 2 queries per step.`;
  if (!prior) {
    return `${base}\n\nYou have no information about the human you work for. Explore as a neutral, capable researcher. The "receipts" and "prunes" fields must be empty arrays.`;
  }
  return `${base}\n\nYou work for a specific human researcher. Their standing research prior — compiled from what they actually read, highlighted, annotated, and argued about — is below. Let it steer selection: prefer directions their taste supports, avoid what they are averse to, and exploit their open questions.\n\nRECEIPTS RULE: whenever a specific line of the prior steers a choice, cite it — ref = the [hl_…]/[cnv_…]/[doc_…] id on that line if present, else a short verbatim fragment of the line; quote = the prior line itself. Cite ONLY when a line genuinely changed your choice; otherwise leave receipts empty. Never fabricate.\n\nPRUNES RULE: if the prior contains an aversion or negative stance that applies to any CURRENT direction listed in the state, prune it (direction = its text verbatim, reason = one short sentence, receipts = the prior line). Only prune on real evidence in the prior.\n\n=== THE PRIOR (PRIOR.md) ===\n${prior}\n=== END PRIOR ===`;
}

function stateBlock(run, question) {
  const dirs = run.directions.map((d) => `- ${d}`).join('\n') || '(none yet)';
  const results = run.lastResults
    .map((r) => `- ${r.title} <${r.url}> — ${r.snippet}`)
    .join('\n') || '(none yet — this is the first step)';
  return `QUESTION: ${question}\n\nCURRENT DIRECTIONS:\n${dirs}\n\nQUERIES ALREADY RUN: ${[...run.queries].join(' | ') || '(none)'}\n\nLATEST SEARCH RESULTS:\n${results}\n\nEmit this step's output.`;
}

export async function runDual({ question, getPrior, steps = 4, emit, search = exaSearch }) {
  const mkRun = (name) => ({
    name, nid: 0, directions: [], queries: new Set(), urls: new Set(), lastResults: [],
  });
  const runs = { vanilla: mkRun('vanilla'), prior: mkRun('prior') };
  const node = (run, props) => {
    const n = { id: `${run.name}-${++run.nid}`, parentId: null, receipts: [], ...props };
    emit({ t: 'node', run: run.name, step: run.step, node: n });
    return n;
  };

  const stepRun = async (run, usePrior) => {
    const prior = usePrior ? getPrior() : null;
    const out = await completeJSON({
      system: systemPrompt(prior),
      user: stateBlock(run, question),
      schema: STEP_SCHEMA,
    });
    for (const p of out.prunes || []) {
      run.directions = run.directions.filter((d) => d !== p.direction);
      node(run, { kind: 'note', text: `✕ pruned: ${p.direction} — ${p.reason}`, receipts: p.receipts });
    }
    for (const d of (out.directions || []).slice(0, 2)) {
      run.directions.push(d.text);
      node(run, { kind: 'direction', text: d.text, receipts: d.receipts });
    }
    run.lastResults = [];
    for (const q of (out.queries || []).slice(0, 2)) {
      if (run.queries.has(q.q)) continue;
      run.queries.add(q.q);
      const qNode = node(run, { kind: 'query', text: q.q, receipts: q.receipts });
      emit({ t: 'status', run: run.name, text: `exa: ${q.q}` });
      const results = await search(q.q, { numResults: 3 });
      for (const r of results) {
        run.urls.add(r.url);
        node(run, { kind: 'result', text: r.title, url: r.url, parentId: qNode.id });
        run.lastResults.push(r);
      }
    }
  };

  const divergence = () => {
    const A = new Set([...runs.vanilla.queries, ...runs.vanilla.urls]);
    const B = new Set([...runs.prior.queries, ...runs.prior.urls]);
    if (A.size === 0 && B.size === 0) return 0;
    const inter = [...A].filter((x) => B.has(x)).length;
    const union = new Set([...A, ...B]).size;
    return Number((1 - inter / union).toFixed(2));
  };

  for (let step = 1; step <= steps; step++) {
    runs.vanilla.step = step;
    runs.prior.step = step;
    emit({ t: 'status', run: 'system', text: `step ${step}/${steps}` });
    await Promise.all([stepRun(runs.vanilla, false), stepRun(runs.prior, true)]);
    emit({ t: 'divergence', value: divergence() });
  }

  // Write-back: what judgment did the conditioned run need but not have?
  const morning = await completeJSON({
    system: systemPrompt(getPrior()),
    user: `${stateBlock(runs.prior, question)}\n\nThe run is ending. List 2-3 QUESTIONS FOR THE MORNING: branch decisions you faced where the prior was silent — one line each, phrased so the human can answer in one line. Their answers will be appended to the prior so no future run has to ask again.`,
    schema: MORNING_SCHEMA,
  });
  for (const q of morning.questions.slice(0, 3)) {
    node(runs.prior, { kind: 'note', text: `? morning: ${q}` });
  }
  emit({ t: 'done', run: 'vanilla' });
  emit({ t: 'done', run: 'prior' });
  return { divergence: divergence(), morningQuestions: morning.questions };
}
