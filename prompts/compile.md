You are compiling PRIOR.md — a researcher's taste, condensed into a single file that autonomous research agents load before they run.

The current time is {{NOW}}. Evidence stats: {{STATS}}

Below is the researcher's complete trace from their Papiers library, fetched via the read-only `papiers` CLI: every document they engaged with (with engagement counts), every highlight (with their annotation, when they wrote one), their most recent AI conversations about papers — and the `backlog` field: the full library scan, including UNREAD saves (recent titles + counts) and `topSources`, the accounts the researcher most often saves from. The researcher curates far more than they read: a save means "someone I trust surfaced this and my instinct flagged it" — that is a judgment event even when the item was never opened. Title clusters in the unread backlog reveal aspirations and technique interests (tier: saved); `topSources` is an implicit trust graph.

<evidence>
{{EVIDENCE}}
</evidence>

Produce PRIOR.md. Rules of the artifact:

1. **It is an index, not a summary.** Every claim you make must carry inline receipts — the full IDs, like `[hl_cebb8f36ac2e633504f90cd78d622c8a]` or `[doc_…]` or `[cnv_…]`. Never truncate IDs: agents resolve them with `papiers read <id>`. A claim without a receipt is worthless.
2. **Attention is not endorsement — for beliefs.** A bare highlight means "this caught my attention." Only annotations and conversation excerpts carry polarity (agreement, doubt, excitement, dismissal). State beliefs only where the researcher's own words support them; otherwise call it a hunch or an open question. Never fabricate a stance. EXCEPTION — techniques: for concrete, actionable methods (an optimization trick, a tool, an algorithmic move), the save itself is the speech act — saving it means "candidate move, try this." Techniques need no polarity; they need recency, cluster mass, and source credibility.
3. **Taste has a derivative.** Use timestamps relative to now. Order threads by recency-weighted activity. Label each thread's momentum: `rising`, `steady`, or `cooling`.
4. **Be honest about thinness.** State evidence counts per thread. If a thread rests on three highlights, say so.
5. Length target: 120–220 lines. Dense, specific, quotable. No filler.

Structure (exactly these sections):

```
# PRIOR — <infer the researcher's name/identity if evident, else "this researcher">
> Compiled <date> from <N> documents, <N> highlights (<N> annotated), <N> conversations.
> This file is an index into a library, not a summary of it. Every [id] resolves via
> `papiers read <id>`. To go beyond this file: `papiers search "<query>"` searches all
> passages, highlights, and conversations; `papiers list --kind highlight --since 7d`
> shows the freshest signal.

## Stance
<3–6 sentences: who this researcher appears to be, what they are circling, how they think.
Grounded in the evidence — cite receipts even here.>

## Active threads
### 1. <thread name> · momentum: <rising|steady|cooling> · last touched <date> · <n> highlights, <n> annotations
**Asking:** <the live question(s) in this thread>
**Where I stand:** <beliefs with polarity, backed by annotations/conversations; hunches labeled as hunches> [receipts]
**Heading:** <where attention in this thread is moving, from the timestamps>
**Dig deeper:** [doc_…] [hl_…] [cnv_…]

<3–8 threads. Cluster by intellectual content, not by paper.>

## Aversions & negative space
<Only what the evidence supports: things argued against in annotations/conversations,
directions conspicuously absent given the library's shape, threads that went cold.
If evidence is thin here, say so in one line rather than inventing.>

## Techniques & promising moves
<Concrete, actionable techniques the researcher has curated — governed by the technique
exception to rule 2: the save is the signal. One line per technique: what it is, when to
reach for it, confidence tier, receipts. Confidence ladder: tried (used in a chat) >
endorsed (annotated) > saved (bare save/highlight, including UNREAD backlog items — cite
their doc_ ids). Rank by recency × cluster mass (several saves in one area = a hot
cluster) × source credibility. Name the backlog clusters explicitly (e.g. "GPU/CUDA
learning materials — 12 unread saves"). Omit the section entirely only if the library
contains no actionable technique content.>

## Trusted sources
<The implicit trust graph from `backlog.topSources`: one line per notable source —
handle, save count, and what kind of signal the researcher goes to them for (inferred
from the titles). Skip sources that are clearly noise (e.g. hiring posts).>


## Last 7 days
<Chronological digest of the freshest activity — this is the section an overnight
run should weight hardest. Receipts on every line.>

## Index
<Compact machine-readable map: one line per thread — thread name → the doc/hl/cnv IDs
that constitute it. Then one line per cited document: doc_id → title.>
```

Output ONLY the contents of PRIOR.md. No preamble, no code fences, no commentary.
