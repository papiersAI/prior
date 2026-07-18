# prior

> The taste interface for autonomous research. What you read today steers what your agents explore tonight.

Built at the AutoResearch Summit & Build Session, AGI House — July 18, 2026.

## The idea

Every autoresearch system — Karpathy's AutoResearch, AlphaEvolve, ENPIRE — shares one bounding constraint: judgment. Generation is cheap; knowing which branch matters is scarce. In the Karpathy Loop, the *one* artifact the human still writes by hand is `program.md` — "a researcher's accumulated taste, compressed into a few sentences."

`prior` compiles that file from data. Your research library is revealed preference: what you chose to read, what you highlighted, what you annotated, what you argued about with your AI. That trace already exists — it just isn't machine-consumable. `prior` makes it a first-class input to the research loop.

This is a **prior** in the Bayesian sense: an initialization that makes automated search sample-efficient. The human is not in the loop. The human's judgment is.

## What `prior` actually is

Three layers. The file contract is the product; everything else is a reference implementation.

### 1. The artifact contract — `PRIOR.md`

A prior is a markdown file an agent loads before it runs. The **body is yours** — different researchers will want different priors, and no compiler can foresee them all. What agents rely on is a small contract:

- **Provenance + resolver header.** The file declares where its evidence lives and how to resolve it (here: `papiers read <id>`). Another trace store can declare a different resolver.
- **Receipts.** Every claim carries inline IDs (`[hl_…]`, `[cnv_…]`, `[doc_…]`). The file is an *index into a library, not a summary of it* — an agent that wants more depth resolves the receipt instead of trusting the compression.
- **Freshness.** Compiled-at stamp and recency signals, so a loop can weight today's reading over last month's.

### 2. A reference compiler — `prior compile` (a compiler is a prompt)

```
prior compile [--out PRIOR.md] [--prompt prompts/compile.md]
```

Fetches your full trace through the read-only [`papiers` CLI](https://www.npmjs.com/package/papiers) (documents + engagement, all highlights + annotations, recent conversations), then distills it with an LLM. The entire compiler is [`prompts/compile.md`](prompts/compile.md) — our opinionated schema (stance → active threads with momentum → aversions → last-7-days → index; the brief you'd hand a new PhD student joining your group). Want a different prior? **Edit the prompt or bring your own with `--prompt`.** Compilers are prompts; fork ours.

### 3. The injection points — where the prior enters the loop

- **Init** — `PRIOR.md` goes into the loop's standing context. This is the `program.md` slot, compiled instead of hand-written.
- **Branch scoring** — when the loop ranks candidate directions or search queries, the prior conditions the scorer, and every prior-steered choice cites the exact line that steered it. No vibes; receipts.
- **Drill-down** — mid-run, the agent resolves receipts (`papiers read <id>`) or searches the full library (`papiers search "…"`) when the prior's compression isn't enough.
- **Write-back** — an overnight run ends its report with the judgments it needed but didn't have: *questions for the morning*. Your one-line answers are appended to `PRIOR.md`. Tomorrow night's run doesn't ask again. Interruptions decay across nights; the prior compounds.

## Demo: the night shift

Autoresearch runs overnight. The question is what it knows about *you* when it starts. Two identical Exa-driven research loops, same question, same tools — one vanilla, one conditioned on `PRIOR.md` freshly compiled from a day of reading at this summit. Watch the trajectories diverge; click any diverged node and it cites the judgment that steered it. `PRIOR.md` is under version control: `git diff` shows exactly what today did to your taste.

## Requirements

- [`papiers` CLI](https://www.npmjs.com/package/papiers) installed and authed (`papiers auth login`)
- [Claude Code](https://claude.com/claude-code) (`claude -p` does the distillation — no API keys to manage)

## License

MIT
