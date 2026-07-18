// `prior run` — dual-loop CLI driver. JSONL events on stdout (same contract as
// shared/events.md), human-readable progress on stderr.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runDual } from './loop.mjs';

export async function cliRun(args) {
  const question = args.find((a) => !a.startsWith('--'));
  if (!question) {
    process.stderr.write('usage: prior run "research question" [--steps 4] [--prior PRIOR.md]\n');
    process.exit(1);
  }
  const stepsFlag = args.indexOf('--steps');
  const steps = stepsFlag > -1 ? Number(args[stepsFlag + 1]) : 4;
  const priorFlag = args.indexOf('--prior');
  const priorPath = resolve(priorFlag > -1 ? args[priorFlag + 1] : 'PRIOR.md');

  const getPrior = () => readFileSync(priorPath, 'utf8'); // re-read each step: live edits apply

  const emit = (ev) => {
    process.stdout.write(JSON.stringify(ev) + '\n');
    if (ev.t === 'node') {
      const r = ev.node.receipts?.length ? `  [${ev.node.receipts.map((x) => x.ref).join(', ')}]` : '';
      process.stderr.write(`  ${ev.run.padEnd(7)} ${ev.node.kind.padEnd(9)} ${ev.node.text.slice(0, 100)}${r}\n`);
    } else if (ev.t === 'divergence') {
      process.stderr.write(`  ── divergence: ${(ev.value * 100).toFixed(0)}% ──\n`);
    }
  };

  const res = await runDual({ question, getPrior, steps, emit });
  process.stderr.write(`\ndone. final divergence ${(res.divergence * 100).toFixed(0)}%; morning questions: ${res.morningQuestions.length}\n`);
}
