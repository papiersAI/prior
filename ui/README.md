# prior demo UI

Two Exa-driven research loops on the same question — vanilla vs conditioned on `PRIOR.md` —
diverging in real time, with receipts. Event contract: [`../shared/events.md`](../shared/events.md).

## Run it (two terminals)

Terminal 1 — the server (mock mode replays the scripted dual run):

```sh
cd ..            # repo root
MOCK=1 node server/index.mjs
```

Without `MOCK=1`, **run** drives the real engine instead: the server stages
`PRIOR.md` → `server/.prior-working.md` and spawns
`node prior.mjs pursue "<question>" --rounds 2 --iters 4 --prior server/.prior-working.md`
(needs `.env` keys; ~8–10 min per run). Live prior edits steer the real loop too —
the engine re-reads the working file every step.

Terminal 2 — the UI:

```sh
cd ui
npm i
npm run dev
```

Open http://localhost:5173. Press **run**.

## Two fixtures

- **Search loop** (default): open http://localhost:5173 — headline is the trajectory
  divergence meter; replays `server/fixtures/demo-run.jsonl`.
- **Kernel race** (experiment loop): open **http://localhost:5173/?fixture=kernel** — two
  lanes optimize the same naive numpy attention kernel (propose mutation → benchmark →
  keep/revert). Replays `server/fixtures/demo-kernel-run.jsonl`. The headline flips to
  per-lane speedup vs baseline ("vanilla 19× | prior 85×"), divergence shrinks to a
  secondary "technique divergence" stat, and each column header gets a log-scale best-ms
  sparkline. Failed mutations ("correct:false — reverted") render struck-through.

## Demo beats

- Steps 1–2 the columns mirror each other; from step 3 the right column pivots and the
  divergence meter climbs. Hover a receipt chip to see the quote; click it to flash the
  exact line in the PRIOR.md pane.
- Mid-run, hit **+ aversion** in the PRIOR.md pane, type an aversion (e.g.
  `- Aversion: leaderboard-chasing survey papers`), then **⌘↵** to save. Within two steps
  the prior run emits a "pruned" note citing your edit.

The server never touches the root `PRIOR.md` — live edits go to `server/.prior-working.md`.
