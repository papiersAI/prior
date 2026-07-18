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
