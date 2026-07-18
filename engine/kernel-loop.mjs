// The experiment loop: two lanes optimize the same naive kernel against a fixed
// benchmark. Per iteration per lane: propose ONE mutation (LLM, prior-conditioned
// or vanilla) → run bench.py in a subprocess → keep if faster, revert if not.
// The prior's job is the proposal distribution: which techniques get tried first,
// with receipts to the curated material that seeded them. bench.py keeps it honest.
import { mkdirSync, writeFileSync, readFileSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { completeJSON } from './llm.mjs';
import { REPO_ROOT } from './env.mjs';

const pExecFile = promisify(execFile);

const FAMILIES = ['vectorization', 'precision', 'memory-layout', 'jit-compilation',
  'tiling-fusion', 'algorithmic', 'micro-optimization', 'other'];

const MUTATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    family: { type: 'string', enum: FAMILIES },
    technique: { type: 'string' },
    rationale: { type: 'string' },
    code: { type: 'string' },
    receipts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { ref: { type: 'string' }, quote: { type: 'string' } },
        required: ['ref', 'quote'],
      },
    },
  },
  required: ['family', 'technique', 'rationale', 'code', 'receipts'],
};

const MORNING_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: { questions: { type: 'array', items: { type: 'string' } } },
  required: ['questions'],
};

function systemPrompt(prior, benchSource, arsenal) {
  const base = `You are one iteration of an autonomous kernel-optimization loop. The target is kernel.py, which must define attention(Q, K, V) — single-head causal attention. A fixed benchmark (bench.py, below) checks correctness against a float64 reference (rtol=2e-3, atol=1e-4 — float32 internals are acceptable) and times it; your mutation is KEPT only if best_ms improves, else auto-reverted.

RULES: propose exactly ONE technique per iteration — the smallest change that tests ONE hypothesis. Isolate variables: bundled changes (e.g. JIT + tiling + precision in one shot) make the keep/revert signal uninterpretable, so they are forbidden even when you are confident; climb the ladder one rung at a time. Return the FULL replacement kernel.py. Keep the attention(Q, K, V) signature. numpy 2.4.6 and numba 0.66 are available; imports limited to numpy, numba, math. Max ~120 lines. No file/network I/O. A failed or reverted run is information — do not repeat a failed technique, escalate past it.

=== bench.py (fixed, for reference) ===
${benchSource}
=== end bench.py ===`;
  if (!prior) {
    return `${base}\n\nYou have no information about the human you work for. Choose techniques as a neutral, capable performance engineer. "receipts" must be an empty array.`;
  }
  const arsenalSection = arsenal
    ? `\n\nYour scout already explored the frontier for this objective, seeded by the researcher's prior. Its IDEA ARSENAL (ranked candidate techniques, each with provenance: discovered sources + the seed lines that led there) is below. Draw mutations from it before improvising — that is the point of the pipeline.\n\n=== IDEA ARSENAL ===\n${arsenal}\n=== END ARSENAL ===`
    : '';
  return `${base}\n\nYou work for a specific human researcher. Their standing research prior — compiled from what they actually read, saved, highlighted, and annotated — is below. Let it steer WHICH techniques you try and in what order: prefer moves their curated material supports, honor their aversions.\n\nRECEIPTS RULE: when a specific prior line, arsenal entry, or discovered source steered this technique choice, cite it — ref = the [hl_…]/[cnv_…]/[doc_…] id, or the source URL, or a short verbatim fragment; quote = the line/insight itself. Cite ONLY genuine steering; empty array otherwise. Never fabricate.\n\n=== THE PRIOR (PRIOR.md) ===\n${prior}\n=== END PRIOR ===${arsenalSection}`;
}

function historyBlock(lane) {
  const rows = lane.history.map((h) =>
    `${h.iter} | ${h.family} | ${h.technique} | ${h.outcome} | ${h.kept ? 'KEPT' : 'reverted'}`
  ).join('\n') || '(none yet — kernel.py is the untouched baseline)';
  return `CURRENT kernel.py (best so far, ${lane.bestMs}ms vs ${lane.baselineMs}ms baseline):\n\`\`\`python\n${readFileSync(join(lane.dir, 'kernel.py'), 'utf8')}\n\`\`\`\n\nHISTORY (iter | family | technique | result | kept):\n${rows}\n\nPropose this iteration's single mutation.`;
}

async function runBench(dir) {
  try {
    const { stdout } = await pExecFile('python3', ['bench.py'], {
      cwd: dir, timeout: 90000, maxBuffer: 1e6,
    });
    return JSON.parse(stdout.trim().split('\n').pop());
  } catch (e) {
    return { correct: false, error: e.killed ? 'timeout' : String(e.message || 'crash').slice(0, 200) };
  }
}

export async function runDualBench({ getPrior, iters = 5, emit, arsenal = null }) {
  const benchSource = readFileSync(join(REPO_ROOT, 'bench', 'bench.py'), 'utf8');
  const mkLane = (name) => {
    const dir = join(REPO_ROOT, 'runs', name);
    mkdirSync(dir, { recursive: true });
    copyFileSync(join(REPO_ROOT, 'bench', 'bench.py'), join(dir, 'bench.py'));
    copyFileSync(join(REPO_ROOT, 'bench', 'kernel_baseline.py'), join(dir, 'kernel.py'));
    return { name, dir, nid: 0, history: [], families: new Set(), bestMs: null, baselineMs: null, bestCode: null };
  };
  const lanes = { vanilla: mkLane('vanilla'), prior: mkLane('prior') };
  const node = (lane, iter, props) => {
    const n = { id: `${lane.name}-${++lane.nid}`, parentId: null, receipts: [], ...props };
    emit({ t: 'node', run: lane.name, step: iter, node: n });
    return n;
  };

  emit({ t: 'status', run: 'system', text: 'measuring baseline…' });
  const base = await runBench(lanes.vanilla.dir);
  if (!base.correct) throw new Error(`baseline bench failed: ${base.error || 'incorrect'}`);
  for (const lane of Object.values(lanes)) {
    lane.baselineMs = base.best_ms;
    lane.bestMs = base.best_ms;
    lane.bestCode = readFileSync(join(lane.dir, 'kernel.py'), 'utf8');
    emit({ t: 'metric', run: lane.name, iter: 0, value: base.best_ms });
    node(lane, 0, { kind: 'note', text: `baseline: ${base.best_ms}ms (naive row-loop attention)` });
  }

  const iterate = async (lane, usePrior, iter) => {
    const prior = usePrior ? getPrior() : null;
    const out = await completeJSON({
      system: systemPrompt(prior, benchSource, usePrior ? arsenal : null),
      user: historyBlock(lane),
      schema: MUTATION_SCHEMA,
      maxTokens: 12000,
      effort: 'low',
    });
    lane.families.add(out.family);
    const mNode = node(lane, iter, { kind: 'direction', text: `${out.technique} (${out.family})`, receipts: out.receipts });
    writeFileSync(join(lane.dir, 'kernel.py'), out.code);
    emit({ t: 'status', run: lane.name, text: `bench: ${out.technique}` });
    const res = await runBench(lane.dir);

    let outcome, kept = false;
    if (res.error) outcome = `${res.error} — reverted`;
    else if (!res.correct) outcome = 'wrong output — reverted';
    else if (res.best_ms < lane.bestMs * 0.98) {
      kept = true;
      const delta = Math.round((1 - res.best_ms / lane.bestMs) * 100);
      outcome = `${res.best_ms}ms ✓ kept (−${delta}%)`;
      lane.bestMs = res.best_ms;
      lane.bestCode = out.code;
    } else outcome = `${res.best_ms}ms — no improvement, reverted`;

    if (!kept) writeFileSync(join(lane.dir, 'kernel.py'), lane.bestCode);
    node(lane, iter, { kind: 'result', text: outcome, parentId: mNode.id });
    emit({ t: 'metric', run: lane.name, iter, value: lane.bestMs });
    lane.history.push({ iter, family: out.family, technique: out.technique, outcome, kept });
  };

  for (let iter = 1; iter <= iters; iter++) {
    emit({ t: 'status', run: 'system', text: `iteration ${iter}/${iters}` });
    await Promise.all([iterate(lanes.vanilla, false, iter), iterate(lanes.prior, true, iter)]);
    const A = lanes.vanilla.families, B = lanes.prior.families;
    const union = new Set([...A, ...B]).size;
    const inter = [...A].filter((f) => B.has(f)).length;
    emit({ t: 'divergence', value: union ? Number((1 - inter / union).toFixed(2)) : 0 });
  }

  const morning = await completeJSON({
    system: systemPrompt(getPrior(), benchSource, arsenal),
    user: `${historyBlock(lanes.prior)}\n\nThe run is ending. List 2-3 QUESTIONS FOR THE MORNING: judgment calls you faced where the prior was silent (e.g. precision tolerances, dependency policy like numba, how far to chase micro-optimizations) — one line each, answerable by the human in one line. Answers get appended to the prior so no future run asks again.`,
    schema: MORNING_SCHEMA,
    effort: 'low',
  });
  for (const q of morning.questions.slice(0, 3)) {
    node(lanes.prior, iters, { kind: 'note', text: `? morning: ${q}` });
  }
  emit({ t: 'done', run: 'vanilla' });
  emit({ t: 'done', run: 'prior' });
  return {
    baselineMs: base.best_ms,
    final: { vanilla: lanes.vanilla.bestMs, prior: lanes.prior.bestMs },
    speedup: {
      vanilla: Number((base.best_ms / lanes.vanilla.bestMs).toFixed(1)),
      prior: Number((base.best_ms / lanes.prior.bestMs).toFixed(1)),
    },
    morningQuestions: morning.questions,
  };
}
