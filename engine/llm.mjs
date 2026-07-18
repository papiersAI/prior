// LLM access for loop steps. Uses the Anthropic SDK when ANTHROPIC_API_KEY is set
// (fast, auto-retrying); falls back to headless Claude Code (`claude -p`) so users
// without an API key can still run everything with their existing Claude login.
import './env.mjs';
import { spawnSync } from 'node:child_process';

const MODEL = process.env.PRIOR_MODEL || 'claude-opus-4-8';
const EFFORT = process.env.PRIOR_EFFORT || 'medium'; // loop steps are latency-sensitive

let client = null;
if (process.env.ANTHROPIC_API_KEY) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  client = new Anthropic();
}

export async function completeJSON({ system, user, schema, maxTokens = 8000, effort }) {
  if (client) {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
      output_config: { effort: effort || EFFORT, format: { type: 'json_schema', schema } },
    });
    const text = res.content.find((b) => b.type === 'text')?.text || '';
    return JSON.parse(text);
  }
  // claude -p fallback: ask for bare JSON and strip an eventual fence.
  const prompt = `${system}\n\n${user}\n\nRespond with ONLY a JSON object matching this schema (no prose, no code fence):\n${JSON.stringify(schema)}`;
  const res = spawnSync('claude', ['-p', '--output-format', 'text'], {
    input: prompt, encoding: 'utf8', maxBuffer: 16e6,
  });
  if (res.status !== 0) throw new Error(`claude -p failed: ${res.stderr?.slice(0, 300)}`);
  let text = res.stdout.trim();
  const fence = text.match(/^```(?:json)?\n([\s\S]*)\n```$/);
  if (fence) text = fence[1];
  return JSON.parse(text);
}
