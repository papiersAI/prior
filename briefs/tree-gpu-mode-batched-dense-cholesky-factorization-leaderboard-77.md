# Exploration Brief — GPU MODE — Batched Dense Cholesky Factorization (leaderboard 776)

> Distilled from a recursive idea tree seeded by your curation: 10 unread saves read, 10 signals scouted, 22 ideas explored (0 pruned). Every idea carries receipts back into your library or to discovered sources.

## 1. Fully-fused single-kernel batched Cholesky for the small-n entries via cuSOLVERDx device POTRF · score 8/10


For {4096,32},{1024,64},{256,128},{64,256} the bottleneck is entirely launch/dispatch overhead and memory movement, not FLOPs. Use cuSOLVERDx's __device__ POTRF fused inside one custom kernel: each threadblock (or warp for the tiniest) factors one matrix start-to-finish in shared memory, no intermediate global round-trips, single kernel launch for the batch. Compare head-to-head against cuSOLVER's batched potrfBatched to measure the launch-overhead win. Key tuning: pick threads/block and shared-mem tiling so occupancy hides the coalesced load of A. Since matrices are guaranteed SPD up to FP32 roundoff, skip pivoting/failure paths entirely. Only lower triangle needs to be read/written — exploit symmetry to halve global traffic (the 16MiB footprint entries are memory-bound).

**Deep-dive verdict.** This is the strongest, most concrete move for the small-n leaderboard entries and the fresh evidence directly validates it. cuSOLVERDx explicitly ships a device POTRF (`__device__ void execute(data_type* A, status_type*  Risks: cuSOLVERDx is a header/JIT MathDx dependency that may not be permitted or easy to build in the leaderboard harness; register/shared-mem pressure of unblocked POTRF may cap occupancy and negate the launch-overhead win at n=256; symmetry-halved global traffic complicates coalescing and may not pay off; correctness must still clear the reconstruction-residual checker without pivoting on near-singular cond values.

**Receipts:** [https://docs.nvidia.com/cuda/cusolverdx/get_started/potrf.html] ("cuSOLVERDx exposes a __device__ POTRF that can be fused inside a single custom k"); [https://www.netlib.org/utk/people/JackDongarra/PAPERS/fast-batch-2014.pdf] ("do the entire factorization GPU-only — directly the fused-kernel design for the "); [doc_ba165183b5f6f46b622bc9311ed2eee6] ("classify each benchmark entry as memory-bound (many tiny matrices) vs compute-bo")

## 2. Shape-adaptive dispatch: one-kernel-per-block for tiny n, blocked right-looking for mid, panel-pipelined for huge · score 7/10


The geomean ranking rewards being good everywhere, so build a shape router keyed on (batch, n). For n<=128 (batch 4096..256): assign one matrix per threadblock, load the whole matrix into shared memory (32x32 fp32 = 4KB up to 128x128 = 64KB, fits B200 shared mem), run an unblocked column-by-column Cholesky entirely in registers/shared, one CUDA launch for the whole batch — zero per-matrix launch overhead. For 256<=n<=1024: blocked right-looking (small n needs parallelism) with block_size~16-32, still one matrix per block or a few blocks cooperating. For n>=2048 single/low-batch: switch to left-looking blocked with a separate panel-factor kernel + cuBLAS SYRK/GEMM trailing update. The dongarra fused-panel trick eliminates launch overhead where it dominates; the ICL empirical rule (right-looking small, left-looking large) sets the crossover. Selection is compile-time-templated on n buckets to avoid runtime branching cost.

**Deep-dive verdict.** The shape-adaptive dispatch idea is the correct meta-strategy for this leaderboard: geomean ranking rewards being good across all 15 entries, and no single kernel wins across the 32x32-through-32768x32768 span. The fresh Risks: Crossover thresholds (n=128, n=1024, n=2048) are asserted from CPU/older-GPU literature and may not transfer to B200 FP32; picking them wrong loses geomean on boundary buckets. The paired high-batch entries (n=512..4096) sit exactly at bucket boundaries and may need their own regime rather than sharing with low-batch. Router adds no value if leaf kernels underperform; it is only as good as its slowest-dispatched bucket. Runtime dispatch cost is negligible but the combinatorial testing/tuning surface is large.

**Receipts:** [https://icl.utk.edu/files/publications/2017/icl-utk-987-2017.pdf] ("right-looking is best for small n (needs parallelism) while left-looking wins fo"); [https://www.netlib.org/utk/people/JackDongarra/PAPERS/fast-batch-2014.pdf] ("merge panel factorization (potf2) and TRSM into one kernel to eliminate CUDA lau"); [https://github.com/NVIDIA/warp/blob/7ddcbbb2/warp/examples/tile/example_tile_block_cholesky.py] ("blocked (block_size=16, 128 threads/block) tiled Cholesky reference")

## 3. Install-time kernel autogeneration for the discrete n-bucket set (32,64,128,256,...) · score 7/10

*Lineage: Shape-adaptive dispatch: one-kernel-per-block for tiny n, blocked right-looking for mid, panel-pipelined for huge → this*

Because the benchmark n values are a fixed discrete set of powers of two, adopt IAAT's two-stage model: at install/compile time auto-generate a fully-unrolled, boundary-free unblocked Cholesky kernel specialized per exact n for the tiny-n bucket (n=32,64,128), eliminating all runtime bounds checks and enabling full register/shared-mem residence tuned to that n. This removes the 'frequent boundary processing' cost that IAAT identifies as the small-GEMM bottleneck, and the fixed benchmark grid means the generation set is tiny (no need for hundreds of kernels).

**Receipts:** [https://doi.org/10.48550/arxiv.2208.09822] ("the costs of boundary processing are high and cannot be neglected. To reduce or "); [https://docs.modular.com/max/api/kernels/linalg/matmul/gpu/sm100_structured/grouped_block_scaled_1d1d/dispatch/] ("comptime DECODE_AVG_M = 8")

## 4. Fallback fused kernel without cuSOLVERDx: hand-written unblocked shared-mem POTRF if MathDx unavailable in harness · score 7/10

*Lineage: Fully-fused single-kernel batched Cholesky for the small-n entries via cuSOLVERDx device POTRF → this*

De-risk the header dependency: implement the same single-launch, batch-per-block fusion with a hand-rolled unblocked right-looking Cholesky in shared memory (column-by-column: sqrt diagonal, scale sub-column, rank-1 trailing update), lower-triangle-only, no pivoting. This reproduces the fused-kernel data-movement win independent of whether cuSOLVERDx compiles in the submission environment, and gives a clean A/B against the cuSOLVERDx device POTRF where it is available.

**Receipts:** [https://docs.nvidia.com/cuda/cusolverdx/get_started/functions/potrf.html] ("For lower fill mode, only the lower triangular part of A is processed, and repla"); [https://www.netlib.org/utk/people/JackDongarra/PAPERS/fast-batch-2014.pdf] ("")

## 5. Persistent tile-ownership single-kernel design imported from Non-Delayed Cholesky for the n=256 batch entry · score 7/10

*Lineage: Fully-fused single-kernel batched Cholesky for the small-n entries via cuSOLVERDx device POTRF → this*

At n=256 the unblocked device POTRF hits register/shared-mem pressure. Borrow the Non-Delayed Cholesky insight — tile-centric persistent kernel where each block owns one tile for its lifetime and trailing updates run GEMM-style with async dependency tracking instead of coarse global barriers — but scoped to intra-matrix tiles of a single 256x256 factorization while still batching 64 matrices across the grid. This converts the GEMM efficiency argument (>90% conversion) into the mid-small regime where the pure unblocked fusion runs out of on-chip budget.

**Receipts:** [https://dl.acm.org/doi/10.1145/3797905.3800554] ("each thread block assumes lifetime ownership of a single matrix tile, performing")

## 6. Robust per-cell selection with median-of-k timing and tie-band fallback to a safe default kernel · score 7/10

*Lineage: Shape-adaptive dispatch: one-kernel-per-block for tiny n, blocked right-looking for mid, panel-pipelined for huge → Ablation-tuned crossover table with a boundary regime for the paired high-batch n=512..4096 entries → this*

For each of the 15 (batch,n) cells, run all 3 candidate kernels k times, take the median runtime, and only override the safe-default kernel if the winner beats it by more than a noise margin (e.g. >5%). Within the tie-band, keep the most robust kernel to avoid the H20-observed 0.73x single-shot autotuning regression. This turns the comptime lookup into a confidence-gated table rather than raw argmin.

**Receipts:** [https://github.com/CarrotSwordsman/H20-LLM-Cookbook/blob/main/reports/2026-06_h20_moe_tuning.md] ("the chosen "best" config at one grid point happens to be slightly worse than the"); [https://github.com/vllm-project/vllm/pull/44152] ("worst 0.73× at E=64, N=2560, batch=512 ... look like single-shot autotuning arte")
