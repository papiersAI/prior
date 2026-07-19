# Exploration Brief — GPU MODE — Batched Dense Cholesky Factorization (leaderboard 776)

> Distilled from a recursive idea tree seeded by your curation. Each surviving idea is labeled against a no-corpus ablation — same model, same task, no saves, no scout, one fixed shot: **model-native** (the model had it anyway), **corpus-steered** (your corpus sharpened it), **corpus-dependent** (no baseline counterpart).

## 1. One-block-per-matrix fused shared-memory Cholesky for the tiny/small-n high-batch regime · 9/10 · model-native

*Ablation: Baseline idea 2 is the same one-block-per-matrix shared-memory Cholesky for small-n high-batch.*

For all entries where n<=256 (batch=4096/n=32, 1024/64, 256/128, 64/256, and the high-batch 640/512), assign exactly one CUDA thread block per matrix and factorize entirely in shared memory using intra-block __syncthreads barriers. Load the lower triangle into shared memory once, run an unblocked right-looking Cholesky (compute diag sqrt, scale column, rank-1 trailing update) with the whole block cooperating, then write back. This eliminates all per-batch library launch overhead — the dominant cost in this regime per Horace He's overhead taxonomy. For n=32 use sub-warp / one-warp-per-matrix packing so multiple matrices share a block and stay register/shared resident, matching MAGMA's 'tiny' special-cased design (up to 11.8x on V100). Tune shared-mem tiling and warp assignment per shape. This regime is ~half the geomean entries, so winning it dominates the score.

**Receipts:** [https://icl.utk.edu/files/publications/2016/icl-utk-909-2016.pdf] [https://www.sciencedirect.com/science/article/abs/pii/S1877750316305154] [doc_0800256bddaa9fe09044228b3ba496b3] [https://docs.nvidia.com/cuda/cusolverdx/get_started/potrf.html]

## 2. Register-resident warp-shuffle Cholesky for n<=32 with N matrices packed per block · 8/10 · model-native

*Ablation: Baseline idea 3 is the same warp-shuffle register kernel for n=32/64.*
*Lineage: One-block-per-matrix fused shared-memory Cholesky for the tiny/small-n high-batch regime → this*

For the batch=4096/n=32 entry (and reusable for n=64 sub-tiles), store each matrix in registers — one thread owns one row — and perform the rank-1 trailing update via __shfl_sync broadcasts of the pivot column instead of shared memory, per MAGMA's register-file version. Pack multiple 32x32 matrices per block (one warp per matrix) so 8+ matrices stay resident; registers are faster than shared (256KB register file vs 64KB shmem on P100) and avoid the __syncthreads cost that dominates tiny sizes. Sweep matrices-per-block for occupancy. This is the single largest-batch entry (4096) and geomean-critical.

**Receipts:** [https://par.nsf.gov/servlets/purl/10065617] [https://icl.utk.edu/files/publications/2018/icl-utk-1056-2018.pdf] [https://www.sciencedirect.com/science/article/abs/pii/S1877750316305154]

## 3. Fuse interleaved gather into the warp-shuffle kernel's load phase (zero-restage) · 7/10 · corpus-dependent

*Ablation: No baseline counterpart for fusing interleaved gather into load addressing (zero-restage transpose avoidance).*
*Lineage: One-block-per-matrix fused shared-memory Cholesky for the tiny/small-n high-batch regime → Register-resident warp-shuffle Cholesky for n<=32 with N matrices packed per block → Interleaved (transposed-batch) memory layout feeding the register-resident n=32 kernel → this*

Do NOT materialize a transposed tensor. Instead, in the register-resident n=32 kernel, compute the interleaved global address at load time so lane t of warp w reads element (row_t, col) of matrix m at address base + (row*n+col)*batch + m — i.e. the strided/interleaved index — turning each warp's load of a given (row,col) across its resident matrices into a single coalesced 128B transaction. This gets the coalescing win of interleaving without the separate permute pass the parent worries about. A/B directly against canonical-layout loads in the same kernel; keep whichever wins on the 4096/n=32 entry.

**Receipts:** [https://icl.utk.edu/files/publications/2017/icl-utk-1364-2017.pdf] [https://moonmath.ai/cdna3attention/]

## 4. Right-looking blocked GEMM-heavy factorization for the single large matrix (n>=4096) entries · 6/10 · model-native

*Ablation: Baseline idea 4/5 cover blocked right-looking factorization for large n.*

For n=4096, 8192, 16384, 32768 (batch 1-2), the problem is compute-bound, so lean on a classic right-looking blocked Cholesky: partition into NBxNB tiles, factor the diagonal panel (POTRF), TRSM the panel below, then SYRK/GEMM the trailing submatrix — the trailing update is the FLOP sink and should route to cuBLAS SGEMM (near-peak TF32/FP32) or a custom pipelined CUTLASS GEMM. Key win over cuSOLVER-as-is: a custom batched DSYRK that writes only the lower triangle (Dongarra reports ~4x over cuBLAS-GEMM-based syrk) and software pipelining (overlap tile loads with compute) per the Colfax GEMM tutorial. Sweep block size NB (128-512) against the roofline. Since these single-matrix entries carry equal geomean weight to a tiny-matrix entry, a well-tuned blocked path is essential but individually lower-leverage than the batched regime.

**Receipts:** [https://www.netlib.org/utk/people/JackDongarra/PAPERS/fast-batch-2014.pdf] [doc_5f11c747ee974d16234fa90c6b91cb9c] [doc_0800256bddaa9fe09044228b3ba496b3]

## 5. Per-shape kernel dispatch driven by an offline roofline classification · 6/10 · corpus-steered

*Ablation: Baseline idea 1 is regime-split dispatch, but corpus adds explicit offline roofline classification and static per-shape tuning.*

Rather than one algorithm, build a dispatcher that classifies each of the 15 benchmark shapes into a regime (launch-overhead-bound tiny-batch, occupancy-bound mid, bandwidth/compute-bound large) using a roofline model, and picks the pre-tuned kernel + config for each. Concretely: precompute a static lookup keyed on (batch, n) mapping to {fused-one-block, warp-packed-tiny, blocked-right-looking, cuSOLVER-fallback} plus tile sizes. This is exactly MAGMA's finding that 'classic' vs 'big-tile' settings win for different sub-tasks. Because ranking is geomean across all entries, no single entry can be neglected — a dispatcher that avoids the worst-case-per-shape is the geomean-optimal meta-strategy. Low-risk, high-leverage scaffolding that makes the other ideas composable.

**Receipts:** [https://icl.utk.edu/files/publications/2016/icl-utk-909-2016.pdf] [doc_ba165183b5f6f46b622bc9311ed2eee6] [https://www.sciencedirect.com/science/article/abs/pii/S1877750316305154]

## 6. cuSOLVER batched potrfBatched / cuBLAS baseline as correctness floor and fallback · 6/10 · corpus-steered

*Ablation: Baseline idea 5 uses cuSOLVER for large n; corpus frames it as correctness floor/fallback across all shapes, more explicitly a baseline strategy.*

Ship torch.linalg.cholesky or cusolverDnSpotrfBatched as a first-cut baseline that is guaranteed correct against the property-based checker (lower-triangular, positive diagonal, low residual), then only replace shapes where a custom kernel measurably beats it. This is the pragmatic 'ship something that passes, then optimize the geomean' move — the checker validates reconstruction residual not elementwise match, so any numerically stable path qualifies. Value is as a safety net and as the measurement harness: every custom kernel is validated diff'd against this. Modest ceiling on its own (library launch overhead loses the tiny-batch entries) but de-risks the whole effort and matches the 'execution/ship' ethos.

**Receipts:** [https://docs.nvidia.com/cuda/cusolverdx/get_started/potrf.html] [doc_0800256bddaa9fe09044228b3ba496b3]

## Appendix: the no-corpus baseline

Same model, same task spec, no corpus, one fixed shot. What it proposed:

1. **Regime-split dispatch: custom batched kernel for small n, cuSOLVER for large n** — Branch on (batch, n) at entry. For small matrices (n<=256) with large batch (4096..64), use a single custom CUDA kernel where one block factorizes one matrix, loading the whole matrix into shared memo
2. **One-block-per-matrix shared-memory Cholesky for the small-n high-batch tail** — Targets {4096,32},{1024,64},{256,128},{64,256}. Assign one thread block per matrix; cooperatively load the lower triangle into shared memory (n<=128 fits comfortably: 128*128*4=64KB, use n=32/64 with 
3. **Warp-per-matrix vectorized kernel specialized for n=32 and n=64** — For n=32 (batch 4096): one warp = one matrix, each lane owns one column. Store columns in registers, use __shfl to broadcast the pivot column during rank-1 updates, __shfl reductions for diagonal dot 
4. **Blocked right-looking Cholesky with cuBLAS batched GEMM/SYRK/TRSM for mid-to-large n** — For n in 512..4096, tile matrix into b x b blocks (b=32 or 64). Loop over diagonal blocks: factor diagonal block (small custom kernel or cusolverDnSpotrfBatched on the block), then batched TRSM (cubla
5. **Single large-matrix path using cusolverDnXpotrf with 64-bit API and workspace reuse** — For the {1,4096..32768} entries, use cusolverDnXpotrf (the newer 64-bit generic API) which internally does blocked panel factorization over cuBLAS and scales to 32768x32768 (4GB fp32). Pre-query and c
6. **Fused load-factor-store with on-the-fly upper-zeroing to cut memory passes** — Across all custom kernels, avoid separate torch.tril masking passes. Allocate output L, and within the factorization kernel write only the lower triangle and explicitly store 0 to strict-upper entries
7. **Precision-safe diagonal handling and cond robustness without extra cost** — Because inputs span wide dynamic range (cond control, scaled rows/cols, damped low-rank), guard the sqrt of the diagonal: clamp A[j,j]-sum to a tiny positive floor (e.g. eps*trace) only when nonpositi
