// Ring 0 of the scout: the researcher's own library — especially the unread
// backlog. A save is a signal ("this seemed promising") even when it was never
// opened; the scout reads it for them. All access via the read-only papiers CLI.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from './env.mjs';
import { completeJSON } from './llm.mjs';

function papiers(args) {
  const out = execFileSync('papiers', [...args, '--json'], { encoding: 'utf8', maxBuffer: 64e6 });
  const parsed = JSON.parse(out);
  if (parsed.ok === false) throw new Error(parsed.error?.message || 'papiers error');
  return parsed;
}

export function listAllDocs({ refresh = false, cap = 4000 } = {}) {
  const cachePath = join(REPO_ROOT, '.prior', 'docs-cache.json');
  if (!refresh && existsSync(cachePath)) return JSON.parse(readFileSync(cachePath, 'utf8'));
  const docs = [];
  let cursor;
  while (docs.length < cap) {
    const args = ['list', '--kind', 'document', '--order-by', 'addedAt:desc', '--limit', '50'];
    if (cursor) args.push('--cursor', cursor);
    const page = papiers(args);
    docs.push(...(page.items || []).map((d) => ({
      id: d.id,
      title: d.title || '(untitled)',
      domain: d.metadata?.sourceDomain || d.source?.domain,
      url: d.source?.url,
      highlights: d.metadata?.highlightCount ?? 0,
      engaged: Boolean(d.metadata?.lastEngagedAt),
    })));
    cursor = page.page?.nextCursor;
    if (!cursor || (page.items || []).length < 50) break;
  }
  mkdirSync(join(REPO_ROOT, '.prior'), { recursive: true });
  writeFileSync(cachePath, JSON.stringify(docs));
  return docs;
}

export async function selectBacklog(objective, docs, { max = 8 } = {}) {
  const lines = docs
    .map((d) => `${d.id} | ${d.engaged ? 'read' : 'UNREAD'} | ${d.title.slice(0, 110)}`)
    .join('\n');
  const out = await completeJSON({
    system:
      'You select items from a researcher\'s library that are relevant to an objective. Strongly prefer UNREAD saves — the researcher saved them as promising and never read them; mining that backlog is the point. Return ONLY ids that appear in the list, best first.',
    user: `OBJECTIVE: ${objective}\n\nLIBRARY (${docs.length} items, "id | read-state | title" per line):\n${lines}\n\nReturn the ${max} most relevant ids.`,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: { ids: { type: 'array', items: { type: 'string' } } },
      required: ['ids'],
    },
    effort: 'low',
    maxTokens: 2000,
  });
  const known = new Set(docs.map((d) => d.id));
  return out.ids.filter((id) => known.has(id)).slice(0, max);
}

export function readDocs(ids, { maxChars = 2500 } = {}) {
  const out = [];
  for (let i = 0; i < ids.length; i += 8) {
    const batch = ids.slice(i, i + 8);
    try {
      const res = papiers(['read', ...batch, '--format', 'markdown', '--max-chars-per-item', String(maxChars)]);
      for (const it of res.items || []) {
        if (it.error) continue;
        const text = it.content || it.markdown || it.text || it.plain || '';
        if (text) out.push({ id: it.id, title: it.title || it.metadata?.title || it.id, text });
      }
    } catch (e) {
      process.stderr.write(`  warn: library read batch failed: ${e.message}\n`);
    }
  }
  return out;
}
