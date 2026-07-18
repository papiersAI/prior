# prior

> Your research taste, compiled and injected into autoresearch loops. What you curate today steers what your agents explore — and validate — tonight.

Built at the AutoResearch Summit & Build Session, AGI House — July 18, 2026.

## The idea

Autoresearch loops don't lack intelligence — they lack *your* judgment. Every system in this space (Karpathy's AutoResearch, AlphaEvolve, ENPIRE) runs propose → test → keep, and in every one the scarce input is the same: which directions are worth compute. In the Karpathy Loop the one artifact the human still writes by hand is `program.md` — taste, compressed into sentences.

`prior` compiles that from data. And the data is bigger than you think: **you curate far more than you read.** Every save is a judgment event — someone you trust surfaced it, your instinct flagged it — even if you never opened it. A working researcher's library is thousands of these events (this repo's author: 3,256 items, 3,224 never opened). That backlog is not clutter; it's an unexploited prior.

The researcher may or may not be a domain expert in any given objective. When they are, their curation is a head start to exploit; when they're not, the system covers the gap.

## The pipeline: `prior pursue "<objective>"`

```
your library (papiers CLI, read-only)
      │
      ▼
 prior compile ──► PRIOR.md            your taste as an inspectable, versioned,
      │                                hand-editable file: stance, threads with
      │                                momentum, aversions, technique tiers,
      │                                trusted sources — every claim with receipts
      ▼
 scout ─ ring 0: mine the unread backlog (reads what you saved but never read)
       ─ ring 1+: fan out via Exa — recursive adjacency from your seed toward
         the objective, harvesting signals with provenance
      │
      ▼
 idea arsenal                          ranked candidate techniques; each carries
      │                                sources + the seed lines that led there
      ▼
 experiment race                       two lanes optimize the same code against a
      │                                fixed benchmark: propose ONE mutation → run
      │                                → keep iff faster, revert honestly.
      │                                Vanilla lane = control (no prior, no arsenal).
      ▼
 morning report                        results + the judgment calls the loop
                                       couldn't make — answer each in one line;
                                       answers append to the prior. No future run
                                       asks the same question twice.
```

**Provenance is the contract.** Every steered choice cites its chain: experiment ← arsenal idea ← discovered source ← the save/highlight of yours that seeded it. Receipts are `[hl_…]`/`[doc_…]`/`[cnv_…]` ids (resolvable via `papiers read <id>`) or source URLs. A claim without a receipt is worthless; the UI makes every link clickable.

## PRIOR.md: the artifact

The library is the **store**; PRIOR.md is a **materialized view** — regenerated each compile, committed to git, so `git diff PRIOR.md` is a legible trace of your thinking changing. Research changes in bursts, not daily: compile after curation sessions, and the git history shows exactly that.

Evidence rules differ by claim type:
- **Beliefs** need polarity — only your annotations and chat arguments count; a bare highlight is attention, not endorsement.
- **Techniques** follow the save-is-the-signal rule: tiers are `tried` (used in a chat) > `endorsed` (annotated) > `saved` (bare save, including unread backlog items).
- **Trusted sources** — the implicit trust graph from who you repeatedly save.

The body is yours: edit it by hand, add an aversion mid-run and watch the loop prune a branch on the next step, citing your line. The compiler itself is just a prompt ([`prompts/compile.md`](prompts/compile.md)) — swap it with `--prompt` to change what a prior even is.

## Commands

```
prior compile [--out PRIOR.md] [--prompt prompts/compile.md]   # library → PRIOR.md
prior run "goal" [--steps 4]                                   # exploration loop (search tier)
prior run --bench [--iters 5]                                  # experiment race only
prior pursue "objective" [--rounds 3] [--iters 5]              # full pipeline
```

UI: `node server/index.mjs` + `cd ui && npm run dev` → http://localhost:5173 — dual trajectory lanes, speedup sparklines, live-editable prior pane. `MOCK=1` replays recorded fixtures.

Requirements: [`papiers` CLI](https://www.npmjs.com/package/papiers) (authed), Node ≥ 22, Python 3 + numpy (numba optional) for the bench. LLM: `ANTHROPIC_API_KEY`, or none — falls back to `claude -p` via your Claude Code login. Search: `EXA_API_KEY` (mock mode without).

## Honest boundaries

- **The A/B is real and the prior is allowed to lose.** Same loop, same tools; the only variable is the file. Divergence and the metric are measured, not narrated.
- The prior's lift is largest on **open-ended objectives** (what to pursue, which approach family) and smallest on closed terminal grinds (a leaderboard with a perfect evaluator) — which is the thesis: taste matters most where evaluators are weakest.
- The bundled benchmark (numpy causal attention, CPU) is a legible stand-in for the execution tier. Swap in a GPU sandbox; the contract doesn't change.
- Write-back today appends answered questions to PRIOR.md (declared compile input). Roadmap: a `prior note` write path into the library itself, task-scoped views (`prior compile --for "<goal>"`), and a `prior watch` daemon that recompiles on curation events and auto-pursues promising deltas.

## License

MIT
