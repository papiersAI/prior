// One-off: ablation-label the surviving ideas of a recorded tree run, then
// regenerate the brief (file + the {t:"brief"} event inside the fixture) so
// the labels appear in the demo path. Baseline = same model, same task, no
// corpus, no scout — one fixed shot. Labels: model-native / corpus-steered /
// corpus-dependent, judged strictly (over-claiming dependence kills trust).
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { completeJSON } from './llm.mjs';
import { REPO_ROOT } from './env.mjs';

const fixturePath = join(REPO_ROOT, 'server', 'fixtures', 'tree-cholesky.jsonl');
const taskSpec = readFileSync(join(REPO_ROOT, 'bench', 'tasks', 'gpumode-cholesky.md'), 'utf8');

const lines = readFileSync(fixturePath, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const nodes = new Map();
for (const ev of lines) {
  if (ev.t === 'node' && ev.run === 'tree') nodes.set(ev.node.id, { ...ev.node });
  if (ev.t === 'update' && nodes.has(ev.nodeId)) Object.assign(nodes.get(ev.nodeId), { score: ev.score ?? nodes.get(ev.nodeId).score, status: ev.status ?? nodes.get(ev.nodeId).status });
}
const survivors = [...nodes.values()]
  .filter((n) => n.kind === 'idea' && n.status !== 'pruned')
  .sort((a, b) => b.score - a.score)
  .slice(0, 6);

process.stderr.write(`labeling ${survivors.length} surviving ideas…\n`);

const baseline = await completeJSON({
  system: `You are a capable research engineer. TASK SPEC:\n${taskSpec}\n\nProduce 5-7 ranked ideas for the task. Mechanism-level specificity — algorithm and data-movement decisions, not vibes. Shape-aware: say which benchmark regime each idea targets and why. No other context is available.`,
  user: 'Produce the ideas.',
  schema: {
    type: 'object', additionalProperties: false,
    properties: { ideas: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { title: { type: 'string' }, approach: { type: 'string' } }, required: ['title', 'approach'] } } },
    required: ['ideas'],
  },
  maxTokens: 8000, effort: 'high',
});

const labeled = await completeJSON({
  system: `You compare two idea lists for the same task and label each CORPUS idea:
- "model-native": the baseline list contains essentially the same idea.
- "corpus-steered": the baseline has a related idea, but the corpus version is materially sharper, differently targeted, or better justified.
- "corpus-dependent": no meaningful baseline counterpart.
Be strict and honest — over-labeling corpus-dependent destroys credibility. One short note per label naming the baseline counterpart (or its absence).`,
  user: `CORPUS IDEAS:\n${survivors.map((n, i) => `${i + 1}. ${n.text}: ${(n.detail || '').slice(0, 300)}`).join('\n')}\n\nBASELINE IDEAS (no corpus, no scout):\n${baseline.ideas.map((b, i) => `${i + 1}. ${b.title}: ${b.approach.slice(0, 300)}`).join('\n')}\n\nLabel each corpus idea by its number.`,
  schema: {
    type: 'object', additionalProperties: false,
    properties: { labels: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { index: { type: 'integer' }, label: { type: 'string', enum: ['model-native', 'corpus-steered', 'corpus-dependent'] }, note: { type: 'string' } }, required: ['index', 'label', 'note'] } } },
    required: ['labels'],
  },
  effort: 'low', maxTokens: 3000,
});
const byIndex = new Map(labeled.labels.map((l) => [l.index, l]));

// Rebuild the brief with labels + baseline appendix.
const briefEv = lines.find((ev) => ev.t === 'brief');
const counts = { 'model-native': 0, 'corpus-steered': 0, 'corpus-dependent': 0 };
const md = [];
md.push(briefEv.markdown.split('\n')[0]); // keep original H1
md.push('');
md.push(`> Distilled from a recursive idea tree seeded by your curation. Each surviving idea is labeled against a no-corpus ablation — same model, same task, no saves, no scout, one fixed shot: **model-native** (the model had it anyway), **corpus-steered** (your corpus sharpened it), **corpus-dependent** (no baseline counterpart).`);
md.push('');
survivors.forEach((n, i) => {
  const lab = byIndex.get(i + 1);
  if (lab) counts[lab.label]++;
  const chain = [];
  for (let p = nodes.get(n.parentId); p && p.kind === 'idea'; p = nodes.get(p.parentId)) chain.unshift(p.text);
  md.push(`## ${i + 1}. ${n.text} · ${n.score}/10${lab ? ` · ${lab.label}` : ''}`);
  md.push('');
  if (lab) md.push(`*Ablation: ${lab.note}*`);
  if (chain.length) md.push(`*Lineage: ${chain.join(' → ')} → this*`);
  md.push('');
  md.push(n.detail || '');
  if (n.receipts?.length) {
    md.push('');
    md.push(`**Receipts:** ${n.receipts.map((r) => `[${r.ref}]`).join(' ')}`);
  }
  md.push('');
});
md.push(`## Appendix: the no-corpus baseline`);
md.push('');
md.push(`Same model, same task spec, no corpus, one fixed shot. What it proposed:`);
md.push('');
baseline.ideas.forEach((b, i) => md.push(`${i + 1}. **${b.title}** — ${b.approach.slice(0, 200)}`));
md.push('');

briefEv.markdown = md.join('\n');
writeFileSync(fixturePath, lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
writeFileSync(join(REPO_ROOT, 'briefs', 'tree-gpu-mode-batched-dense-cholesky-factorization-leaderboard-77.md'), briefEv.markdown);
process.stderr.write(`done: ${JSON.stringify(counts)}\n`);
