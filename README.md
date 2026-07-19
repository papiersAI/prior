# Prior

**Turn your Papiers library into guidance for autoresearch agents.**

Prior reads the papers, highlights, conversations, and unread saves in your Papiers library, compiles them into an editable `PRIOR.md`, and uses that context to explore a research objective. Every proposed direction stays linked to the sources and judgments that informed it.

Built at the AutoResearch Summit & Build Session at AGI House, July 18, 2026.

## Why

Autoresearch systems are good at proposing and testing solutions. The harder question is what they should investigate in the first place.

Your research library already contains thousands of small decisions about what looked useful, surprising, or worth returning to. Prior makes those decisions available to an agent. It can use your saved work to find relevant starting points, search outward for evidence, and distinguish promising ideas from weak ones.

An unread save is treated as a lead, not an endorsement. Highlights, annotations, conversations, and repeated source choices provide stronger evidence about what you actually believe.

## What It Does

1. **Compiles your library.** `prior compile` reads Papiers through its read-only CLI and writes an inspectable `PRIOR.md`.
2. **Finds relevant sources.** For a research objective, Prior selects useful items from your library and follows them into papers, documentation, and code.
3. **Explores ideas recursively.** It proposes directions, scores them, investigates the strongest candidates, generates sharper descendants, and prunes weak branches.
4. **Shows its work.** The UI exposes the sources in use, the complete activity trace, evaluation rationales, score changes, and surviving idea lineages.
5. **Produces a brief.** The strongest directions are distilled into a Markdown research brief with receipts back to your library and external evidence.

## Demo

Run the recorded exploration locally in two terminals.

```sh
# Terminal 1: repository root
MOCK=1 node server/index.mjs
```

```sh
# Terminal 2
cd ui
npm install
npm run dev
```

Open [http://localhost:5173/?fixture=tree](http://localhost:5173/?fixture=tree), then select **Explore my library**.

The fixture replays a real exploration of a GPU MODE batched Cholesky task. Eleven unread saves seed 22 ideas. The agent investigates eight branches, prunes one, and produces a final brief.

For the optional benchmark view, open [http://localhost:5173/?fixture=kernel](http://localhost:5173/?fixture=kernel).

## CLI

Install the repository and expose the local `prior` command:

```sh
npm install
npm link
```

Compile your Papiers library:

```sh
prior compile
prior compile --out PRIOR.md --prompt prompts/compile.md
```

Explore a research objective:

```sh
prior explore "GPU MODE batched dense Cholesky" \
  --expansions 6 \
  --saves 12 \
  --rounds 2 \
  --prior PRIOR.md
```

The objective may also be a task file:

```sh
prior explore bench/tasks/gpumode-cholesky.md
```

Other workflows:

```sh
prior ideate "objective" --rounds 3 --saves 14    # one-shot idea brief
prior run "research question" --steps 4           # research loop
prior run --bench --iters 5                        # benchmark loop
prior pursue "objective" --rounds 3 --iters 5     # scout, then benchmark
```

## Requirements

- Node.js 22 or newer
- An authenticated [`papiers` CLI](https://www.npmjs.com/package/papiers)
- Claude Code for `prior compile` and as the default local model runner
- `ANTHROPIC_API_KEY` to use the Anthropic API directly during agent loops
- `EXA_API_KEY` for live web research; without it, the search layer uses mock results
- Python 3 and NumPy for the optional benchmark loop; Numba is optional

The main model can be changed with `PRIOR_MODEL`; reasoning effort can be changed with `PRIOR_EFFORT`.

## Provenance

Ideas and evaluations carry receipts rather than unsupported summaries:

- `doc_...` identifies a saved document.
- `hl_...` identifies a highlight or annotation.
- `cnv_...` identifies a conversation.
- HTTP URLs identify external papers, documentation, or code.

Library receipts can be resolved with `papiers read <id>`. In the UI, library receipts open the working `PRIOR.md`; external evidence opens its source URL.

`PRIOR.md` is ordinary Markdown. It can be read, edited, reviewed in a git diff, or replaced with another compiler prompt. During a live run, the engine rereads the working prior between steps, so an edit can change which directions survive.

## Stack

- React 19, Vite, Tailwind CSS 4, and `marked`
- Node.js server with Server-Sent Events
- Anthropic API or Claude Code for model execution
- Exa for adjacent web research
- Papiers CLI for read-only library access
- Markdown files for priors and final briefs

## Boundaries

- Prior reads from Papiers; it does not modify the library.
- A save is a relevance signal, not proof that the researcher agrees with its contents.
- The recursive exploration view is designed for open-ended research decisions. The benchmark loop is a smaller example for tasks with a cheap, objective evaluator.
- Mock mode replays recorded events through the same SSE contract as a live run.
- Provenance makes an agent's reasoning inspectable; it does not make every conclusion correct.

## License

MIT
