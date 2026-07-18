// `prior explore` — the recursive idea tree. JSONL events on stdout, progress on stderr.
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { explore } from './tree.mjs';

export async function cliExplore(args) {
  const target = args.find((a) => !a.startsWith('--'));
  if (!target) {
    process.stderr.write('usage: prior explore <task-file-or-text> [--expansions 6] [--saves 12] [--rounds 2] [--prior PRIOR.md]\n');
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
    if (ev.t === 'node' && ['idea', 'eval', 'seed'].includes(ev.node.kind)) {
      const s = ev.node.score != null ? ` (ev ${ev.node.score})` : '';
      const r = ev.node.receipts?.length ? `  [${ev.node.receipts.map((x) => x.ref).join(', ')}]` : '';
      process.stderr.write(`  ${ev.node.kind.padEnd(6)} ${ev.node.text.slice(0, 100)}${s}${r}\n`);
    } else if (ev.t === 'update') {
      process.stderr.write(`  update ${ev.nodeId}: score ${ev.score}, ${ev.status}\n`);
    } else if (ev.t === 'status' && ev.run === 'system') {
      process.stderr.write(`── ${ev.text} ──\n`);
    }
  };

  const res = await explore({
    taskSpec, taskTitle, getPrior,
    expansions: flag('--expansions', 6), saves: flag('--saves', 12), scoutRounds: flag('--rounds', 2),
    emit,
  });
  process.stderr.write(`\ntree: ${res.nodes.filter((n) => n.kind === 'idea').length} ideas explored; brief: ${res.outPath}\n`);
}
