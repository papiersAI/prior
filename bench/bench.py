# Fixed benchmark harness — the agent may NOT edit this file.
# Imports attention(Q, K, V) from kernel.py in the same directory, checks it
# against a trusted reference (fast-but-wrong = failed run), then times it.
# Prints exactly one JSON line: {"correct": bool, "best_ms": float|null, "runs_ms": [...]}
import json
import sys
import time

import numpy as np

sys.path.insert(0, ".")
from kernel import attention  # noqa: E402


def reference(Q, K, V):
    n, d = Q.shape
    scores = (Q @ K.T) / np.sqrt(d)
    mask = np.tril(np.ones((n, n), dtype=bool))
    scores = np.where(mask, scores, -np.inf)
    scores = scores - scores.max(axis=1, keepdims=True)
    w = np.exp(scores)
    w = w / w.sum(axis=1, keepdims=True)
    return w @ V


def main():
    rng = np.random.default_rng(0)
    n, d = 4096, 64
    Q = rng.standard_normal((n, d))
    K = rng.standard_normal((n, d))
    V = rng.standard_normal((n, d))

    ref = reference(Q, K, V)
    out = np.asarray(attention(Q, K, V), dtype=np.float64)
    correct = out.shape == ref.shape and bool(
        np.allclose(out, ref, rtol=2e-3, atol=1e-4)
    )

    runs = []
    if correct:
        attention(Q, K, V)  # warmup (also triggers JIT compilation if any)
        for _ in range(5):
            t0 = time.perf_counter()
            attention(Q, K, V)
            runs.append((time.perf_counter() - t0) * 1000.0)

    print(json.dumps({
        "correct": correct,
        "best_ms": round(min(runs), 2) if runs else None,
        "runs_ms": [round(r, 2) for r in runs],
    }))


if __name__ == "__main__":
    main()
