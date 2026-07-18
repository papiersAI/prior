#!/usr/bin/env node
// prior — compile a Papiers library into PRIOR.md, a machine-readable research prior.
// Zero dependencies. Reads raw traces via the `papiers` CLI (read-only), distills
// via `claude -p` (headless Claude Code). See prompts/compile.md for the schema.

import { execFileSync, spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync, readFileSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = 50; // server max per papiers list page

function papiers(args) {
  let out;
  try {
    out = execFileSync('papiers', [...args, '--json'], { encoding: 'utf8', maxBuffer: 64e6 });
  } catch (e) {
    const stderr = e.stderr?.toString?.() || '';
    throw new Error(`papiers ${args.join(' ')} failed: ${stderr || e.message}`);
  }
  const parsed = JSON.parse(out);
  if (parsed.ok === false) throw new Error(parsed.error?.message || 'papiers error');
  return parsed;
}

function listAll(kind, extra = [], cap = 400) {
  const items = [];
  let cursor;
  while (items.length < cap) {
    const args = ['list', '--kind', kind, '--limit', String(PAGE), ...extra];
    if (cursor) args.push('--cursor', cursor);
    const page = papiers(args);
    items.push(...(page.items || []));
    cursor = page.page?.nextCursor;
    if (!cursor || (page.items || []).length < PAGE) break;
  }
  return items.slice(0, cap);
}

function readBatch(ids, format, maxChars) {
  const out = [];
  for (let i = 0; i < ids.length; i += 20) {
    const batch = ids.slice(i, i + 20);
    try {
      const args = ['read', ...batch, '--format', format];
      // --max-chars-per-item is only valid for content formats, not metadata
      if (maxChars && ['auto', 'markdown', 'plain'].includes(format)) {
        args.push('--max-chars-per-item', String(maxChars));
      }
      const res = papiers(args);
      out.push(...(res.items || []));
    } catch (e) {
      process.stderr.write(`  warn: read batch failed (${batch.length} ids): ${e.message}\n`);
    }
  }
  return out;
}

function gatherEvidence() {
  process.stderr.write('prior: listing documents…\n');
  const docs = listAll('document', ['--order-by', 'lastEngagedAt:desc'], 150).map((d) => ({
    id: d.id,
    title: d.title,
    authors: (d.metadata?.authors || []).slice(0, 3),
    venue: d.metadata?.venue || undefined,
    year: d.metadata?.publishedYear || undefined,
    source: d.metadata?.sourceDomain || d.source?.domain,
    url: d.source?.url,
    highlights: d.metadata?.highlightCount ?? 0,
    annotations: d.metadata?.annotationCount ?? 0,
    lastEngagedAt: d.metadata?.lastEngagedAt || d.updatedAt,
  }));

  process.stderr.write('prior: listing highlights…\n');
  const hlStubs = listAll('highlight', [], 400);
  process.stderr.write(`prior: reading ${hlStubs.length} highlights…\n`);
  const hlFull = readBatch(hlStubs.map((h) => h.id), 'metadata', 2000);
  const hlById = new Map(hlFull.filter((h) => h && h.id).map((h) => [h.id, h]));
  const highlights = hlStubs.map((h) => {
    const full = hlById.get(h.id) || {};
    const meta = full.metadata || full;
    return {
      id: h.id,
      doc: h.documentId,
      docTitle: h.metadata?.documentTitle || h.title,
      quote: meta.quote || full.quote || h.preview,
      note: meta.annotationText || full.annotationText || undefined,
      at: h.metadata?.createdAt || h.updatedAt,
    };
  });

  process.stderr.write('prior: listing conversations…\n');
  const convStubs = listAll('conversation', [], 100).sort((a, b) =>
    (b.updatedAt || '').localeCompare(a.updatedAt || '')
  );
  const recent = convStubs.slice(0, 8);
  process.stderr.write(`prior: reading ${recent.length} recent conversations (${convStubs.length} total)…\n`);
  const convFull = readBatch(recent.map((c) => c.id), 'plain', 6000);
  const convById = new Map(convFull.filter((c) => c && c.id).map((c) => [c.id, c]));
  const conversations = recent.map((c) => ({
    id: c.id,
    updatedAt: c.updatedAt,
    text: convById.get(c.id)?.content || convById.get(c.id)?.text || convById.get(c.id)?.plain || null,
  }));

  return {
    compiledAt: new Date().toISOString(),
    stats: {
      documents: docs.length,
      highlights: highlights.length,
      annotations: highlights.filter((h) => h.note).length,
      conversationsTotal: convStubs.length,
      conversationsRead: conversations.filter((c) => c.text).length,
    },
    documents: docs,
    highlights,
    conversations,
  };
}

function compilePrior(evidence, outPath, promptPath) {
  const template = readFileSync(promptPath, 'utf8');
  const prompt = template
    .replaceAll('{{NOW}}', evidence.compiledAt)
    .replaceAll('{{STATS}}', JSON.stringify(evidence.stats))
    .replaceAll('{{EVIDENCE}}', JSON.stringify({
      documents: evidence.documents,
      highlights: evidence.highlights,
      conversations: evidence.conversations,
    }));

  process.stderr.write('prior: distilling with claude -p (this takes a minute or two)…\n');
  const res = spawnSync('claude', ['-p', '--output-format', 'text'], {
    input: prompt,
    encoding: 'utf8',
    maxBuffer: 64e6,
  });
  if (res.status !== 0 || !res.stdout?.trim()) {
    throw new Error(`claude -p failed (exit ${res.status}): ${res.stderr?.slice(0, 500)}`);
  }
  let md = res.stdout.trim();
  // Unwrap a single fenced block if the model wrapped the file in one.
  const fence = md.match(/^```(?:markdown)?\n([\s\S]*)\n```$/);
  if (fence) md = fence[1];

  if (existsSync(outPath)) copyFileSync(outPath, join(dirname(outPath), '.prior', 'PRIOR.prev.md'));
  writeFileSync(outPath, md + '\n');
  return md;
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (cmd === 'run') {
    const { cliRun } = await import('./engine/run.mjs');
    await cliRun(args.slice(1));
    return;
  }

  if (cmd === 'pursue') {
    const { cliPursue } = await import('./engine/run.mjs');
    await cliPursue(args.slice(1));
    return;
  }
  const outFlag = args.indexOf('--out');
  const outPath = resolve(outFlag > -1 ? args[outFlag + 1] : 'PRIOR.md');
  // A compiler is a prompt. This flag swaps the whole compiler.
  const promptFlag = args.indexOf('--prompt');
  const promptPath = resolve(promptFlag > -1 ? args[promptFlag + 1] : join(HERE, 'prompts', 'compile.md'));

  if (cmd !== 'compile') {
    process.stderr.write('usage: prior compile [--out PRIOR.md] [--prompt prompts/compile.md]\n       prior run "research question" [--steps 4] [--prior PRIOR.md]\n');
    process.exit(cmd ? 1 : 0);
  }

  const cacheDir = join(dirname(outPath), '.prior');
  mkdirSync(cacheDir, { recursive: true });

  const evidence = gatherEvidence();
  writeFileSync(join(cacheDir, 'evidence.json'), JSON.stringify(evidence, null, 2));
  process.stderr.write(
    `prior: evidence — ${evidence.stats.documents} docs, ${evidence.stats.highlights} highlights ` +
    `(${evidence.stats.annotations} annotated), ${evidence.stats.conversationsRead}/${evidence.stats.conversationsTotal} conversations read\n`
  );

  compilePrior(evidence, outPath, promptPath);
  process.stderr.write(`prior: wrote ${outPath}\n`);
}

await main();
