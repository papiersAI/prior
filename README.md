# prior

> Compile your research library into a machine-readable prior. Autoresearch loops fetch your taste, not just your compute.

Built at the AutoResearch Summit & Build Session, AGI House — July 18, 2026.

## The idea

Every autoresearch system in the room today — Karpathy's AutoResearch, AlphaEvolve, ENPIRE — shares one bounding constraint: automated evaluation. Generation is cheap. Judgment is scarce. In the Karpathy Loop, the *one* artifact the human still writes by hand is `program.md` — "a researcher's accumulated taste, compressed into a few sentences."

`prior` compiles that file from data instead. Your research library is revealed preference: what you chose to read, what you highlighted, what you annotated, what you argued about with your AI. `prior` reads it through the [papiers CLI](https://www.npmjs.com/package/papiers) and emits **`PRIOR.md`** — an inspectable, versioned, hand-editable taste file that research agents consult at branch points.

And judgment *compounds*: when the loop hits a branch the prior can't resolve, it asks the human one question — and writes the answer back into `PRIOR.md`. You are never asked the same class of question twice. Interruptions per run decay; the prior grows as a ledger of (decision context, human choice, rationale).

This is a **prior** in the Bayesian sense — an initialization that makes automated search sample-efficient — not a supervisor gate. The human is not in the loop. The human's judgment is.

## Architecture

```
papiers CLI (read-only: library, highlights, annotations, chats)
        │
        ▼
  prior compile  ──►  PRIOR.md   (beliefs / aversions / weightings, each with a receipt)
        │                 ▲
  prior watch             │ write-back: unresolved branch → one human answer → appended
  (new highlights →       │
   recompile, diff)       │
        ▼                 │
  prior run  ─────────────┘
  (Exa-driven research loop, conditioned on PRIOR.md, forkable:
   run the same loop with and without the prior and watch them diverge)
```

- **`prior compile`** — dump library/highlights/annotations/conversations via `papiers`, distill into `PRIOR.md`
- **`prior watch`** — poll for new highlights (`papiers list --kind highlight --since …`), recompile, show the diff
- **`prior run`** — stepwise research loop: propose queries → Exa search → score & select next expansion (with or without `PRIOR.md` in context); every prior-steered choice cites the exact `PRIOR.md` line
- **`prior fork`** — clone a running loop's frontier; continue both branches for a clean live counterfactual

## Demo: Fork the Loop

Two identical research loops, same seed, same tools. One highlight is made live in the reader. `PRIOR.md` recompiles — a one-line diff. The conditioned loop re-routes its next Exa queries; branches prune; new ones bloom. Trajectory divergence: measured, from one highlight. Click any diverged node: it cites the judgment that steered it.

## License

MIT
