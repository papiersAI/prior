# prior demo — event contract

```
Server: node server/index.mjs  → http://localhost:8787
SSE:    GET /events   → stream; each SSE `data:` is one JSON event:
  { t:"node", run:"vanilla"|"prior", step:number,
    node:{ id:string, parentId:string|null, kind:"query"|"result"|"direction"|"note",
           text:string, url?:string,
           receipts?: [{ref:string, quote:string}] } }   // ref e.g. "hl_ffae…" or "§ Agentic search"
  { t:"divergence", value:number }                        // 0..1
  { t:"status", run:"vanilla"|"prior"|"system", text:string }
  { t:"error", run:"system", text:string }                   // terminal run failure; status may also be emitted for older clients
  { t:"prior", markdown:string }                          // sent on connect + whenever prior changes
  { t:"done", run:"vanilla"|"prior" }
API:
  POST /api/run   {question:string}  → 202; starts dual run
  POST /api/prior {markdown:string}  → 200; replaces prior (affects next step), rebroadcasts {t:"prior"}
  GET  /api/prior → {markdown:string}
  POST /api/stop  → 200
Mock mode: MOCK=1 node server/index.mjs → /api/run replays server/fixtures/demo-run.jsonl with
realistic pacing (400–1200ms between events). A live PRIOR.md edit during mock playback should,
within 2 steps, cause a scripted "pruned" note node citing the edit (fake it: if the posted
markdown contains a line starting "- Aversion:", emit a prior-run note node citing that line text).
```

## Addendum: experiment-loop events

`{ t:"metric", run:"vanilla"|"prior", iter:number, value:number }` — current best benchmark
time in ms for that lane (lower is better); `iter: 0` is the shared baseline. Emitted by
`prior run --bench` after the baseline measurement and after every iteration. Consumers
that don't know this event type should ignore it.

Mock mode fixture selection: `POST /api/run?fixture=kernel` replays
`server/fixtures/demo-kernel-run.jsonl` (the kernel-optimization experiment race, which
emits `{t:"metric"}` events). Without the query param, `/api/run` replays the default
`server/fixtures/demo-run.jsonl` search-loop fixture, exactly as before.

## Addendum: idea-tree events (`prior explore`)

`POST /api/run` now accepts `{question:string, mode:"explore"|"pursue"}` (default
`"explore"`). Non-mock explore spawns `node prior.mjs explore "<question>" --prior
server/.prior-working.md`; `question` may be a task-file path (e.g.
`bench/tasks/gpumode-cholesky.md`) — it is passed through verbatim as one argument.
`mode:"pursue"` keeps the original dual-race command.

Explore streams emit, in addition to `{t:"status"}` / `{t:"prior"}`:

```
{ t:"node", run:"tree", step:number,
  node:{ id, parentId, kind:"root"|"seed"|"idea"|"evidence"|"eval",
         text, detail?, score?, status?, depth?, receipts:[{ref,quote}], url? } }
{ t:"update", nodeId, score, status }   // "frontier"|"expanding"|"expanded"|"pruned"
{ t:"brief", markdown }                  // once, at the end
```

Scout events from the seed-reading phase also appear early with `run:"prior"`; the UI
keeps every emitted event in the inspectable trajectory rail when a tree is on the canvas.

Fixture keys: `?fixture=tree` → `server/fixtures/tree-cholesky.jsonl` (a real recorded
explore run; if the file is absent, `/api/run` answers 409 with a message saying how to
record it) · `?fixture=tree-synthetic` → `server/fixtures/tree-synthetic.jsonl` (hand-
authored development/backup fixture) · `?fixture=ideate` → `server/fixtures/ideate-cholesky.jsonl`.

`{ t:"funnel", stages:[{label:string, n:number}] }` — the seed-selection narrowing funnel
(e.g. library 3256 → relevant 40 → reading 12), emitted once during the scout's ring 0.
