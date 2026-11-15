"""Window statistics and selection over the 36 dekads. Pure functions, no I/O.

Ported from the contract-defining mock (`web/src/mocks/windows.ts`): `backend/tests/unit/test_windows.py` feeds the
`p_success` curves of `contract/examples/recommendation.*.json` through these functions and requires the examples'
`best_windows`, so the live backend and the mock rank identically.
"""

import math
from dataclasses import dataclass

from app.engines.dekads import DEKADS_PER_YEAR, shift_dekad

GOOD_WINDOW_P = 0.7  # a dekad counts as "good" from this success frequency
WILSON_Z = 1.96  # 95% band


@dataclass(frozen=True)
class WindowRun:
    start_dekad: int
    end_dekad: int
    mean_p: float


def wilson_interval(successes: int, n: int, z: float = WILSON_Z) -> tuple[float, float]:
    """Wilson score interval of a proportion. n == 0 gives the uninformative (0, 1)."""
    if n <= 0:
        return 0.0, 1.0
    p = successes / n
    denom = 1 + z * z / n
    centre = (p + z * z / (2 * n)) / denom
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / denom
    return max(0.0, centre - half), min(1.0, centre + half)


def round3(x: float) -> float:
    return math.floor(x * 1000 + 0.5) / 1000


def ranking_score(p: list[float]) -> float:
    """Highest mean p over any 3 consecutive dekads (wrapping): the ranking score."""
    return max(
        (p[d - 1] + p[shift_dekad(d, 1) - 1] + p[shift_dekad(d, 2) - 1]) / 3 for d in range(1, DEKADS_PER_YEAR + 1)
    )


def best_dekad(p: list[float]) -> int:
    """First dekad with the highest p."""
    best = 1
    for d in range(2, DEKADS_PER_YEAR + 1):
        if p[d - 1] > p[best - 1]:
            best = d
    return best


def best_windows(p: list[float]) -> list[WindowRun]:
    """Contiguous runs of dekads with p >= 0.7, best first (max 2); the best 3-dekad run when none reaches 0.7."""
    good = [x >= GOOD_WINDOW_P for x in p]
    runs: list[tuple[int, int]] = []
    if all(good):
        runs.append((1, DEKADS_PER_YEAR))
    else:
        # scan from right after a "bad" dekad so a run is never split at the year boundary
        first_bad = good.index(False) + 1
        current: tuple[int, int] | None = None
        for k in range(1, DEKADS_PER_YEAR + 1):
            d = shift_dekad(first_bad, k)
            if good[d - 1]:
                current = (current[0], d) if current else (d, d)
            elif current:
                runs.append(current)
                current = None
        if current:
            runs.append(current)

    scored: list[WindowRun] = []
    for start, end in runs:
        members = []
        d = start
        while True:
            members.append(d)
            if d == end:
                break
            d = shift_dekad(d, 1)
        total = 0.0
        for m in members:  # plain left-to-right addition: Python's sum() is compensated and would differ from the mock
            total += p[m - 1]
        scored.append(WindowRun(start, end, round3(total / len(members))))
    if scored:
        return sorted(scored, key=lambda w: (-w.mean_p, w.start_dekad))[:2]

    best_start, best_mean = 1, -1.0
    for d in range(1, DEKADS_PER_YEAR + 1):
        mean = (p[d - 1] + p[shift_dekad(d, 1) - 1] + p[shift_dekad(d, 2) - 1]) / 3
        if mean > best_mean:
            best_start, best_mean = d, mean
    return [WindowRun(best_start, shift_dekad(best_start, 2), round3(best_mean))]


def spearman(x: list[float], y: list[float]) -> float | None:
    """Spearman rank correlation with average ranks for ties; None when either side is constant."""

    def ranks(values: list[float]) -> list[float]:
        order = sorted(range(len(values)), key=lambda i: values[i])
        out = [0.0] * len(values)
        i = 0
        while i < len(order):
            j = i
            while j + 1 < len(order) and values[order[j + 1]] == values[order[i]]:
                j += 1
            for k in range(i, j + 1):
                out[order[k]] = (i + j) / 2 + 1
            i = j + 1
        return out

    rx, ry = ranks(x), ranks(y)
    mx, my = sum(rx) / len(rx), sum(ry) / len(ry)
    sxx = sum((a - mx) ** 2 for a in rx)
    syy = sum((b - my) ** 2 for b in ry)
    if sxx == 0 or syy == 0:
        return None
    return sum((a - mx) * (b - my) for a, b in zip(rx, ry, strict=True)) / math.sqrt(sxx * syy)
