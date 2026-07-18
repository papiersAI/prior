# GPU MODE — Batched Dense Cholesky Factorization (leaderboard 776)

Implement batched dense Cholesky factorization. Input is A, a batch x n x n CUDA tensor
in torch.float32. Every matrix is symmetric positive definite up to FP32 roundoff.
Return a lower-triangular FP32 tensor L with positive diagonal such that A = L @ L.T.

The checker validates shape, dtype, device, finiteness, lower-triangular structure,
positive diagonal, and the reconstruction residual against the original FP32 input.
Correctness is property-based rather than elementwise comparison with one library
implementation.

Inputs cover dense covariance-like matrices, planted spectra, diagonal matrices, damped
low-rank matrices, scaled rows and columns, and tridiagonal SPD matrices. The cond field
is a deterministic dynamic-range control.

The benchmark grid emphasizes batched factorization: from thousands of small matrices
through a single 32768 x 32768 matrix. The low-batch entries from n=32 through n=1024
each contain 2^22 FP32 input elements (16 MiB consistent footprint). Paired high-batch
entries at n=512..4096 separately exercise throughput and batch parallelism. Ranking is
by geometric mean of runtime across all entries.

Benchmark shapes:
{"batch":4096,"n":32} {"batch":1024,"n":64} {"batch":256,"n":128} {"batch":64,"n":256}
{"batch":16,"n":512} {"batch":640,"n":512} {"batch":4,"n":1024} {"batch":60,"n":1024}
{"batch":2,"n":2048} {"batch":8,"n":2048} {"batch":1,"n":4096} {"batch":2,"n":4096}
{"batch":1,"n":8192} {"batch":1,"n":16384} {"batch":1,"n":32768}

https://www.gpumode.com/leaderboard/776
