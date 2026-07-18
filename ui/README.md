# prior demo UI

Two Exa-driven research loops on the same question — vanilla vs conditioned on `PRIOR.md` —
diverging in real time, with receipts. Event contract: [`../shared/events.md`](../shared/events.md).

## Run it (two terminals)

Terminal 1 — the server (mock mode replays the scripted dual run):

```sh
cd ..            # repo root
MOCK=1 node server/index.mjs
```

Terminal 2 — the UI:

```sh
cd ui
npm i
npm run dev
```

Open http://localhost:5173. Press **run**.

## Demo beats

- Steps 1–2 the columns mirror each other; from step 3 the right column pivots and the
  divergence meter climbs. Hover a receipt chip to see the quote; click it to flash the
  exact line in the PRIOR.md pane.
- Mid-run, hit **+ aversion** in the PRIOR.md pane, type an aversion (e.g.
  `- Aversion: leaderboard-chasing survey papers`), then **⌘↵** to save. Within two steps
  the prior run emits a "pruned" note citing your edit.

The server never touches the root `PRIOR.md` — live edits go to `server/.prior-working.md`.
