# Baseline kernel — deliberately naive single-head causal attention.
# Row-at-a-time: one small matmul + softmax per query row. Correct, slow.
# The loop's job is to make this fast while bench.py keeps it honest.
import numpy as np


def attention(Q, K, V):
    n, d = Q.shape
    scale = 1.0 / np.sqrt(d)
    out = np.empty((n, d))
    for i in range(n):
        q = Q[i]
        s = (K[: i + 1] @ q) * scale
        s = s - s.max()
        w = np.exp(s)
        w = w / w.sum()
        out[i] = w @ V[: i + 1]
    return out
