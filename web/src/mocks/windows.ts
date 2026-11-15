import type { DekadProbability, PlantingWindow } from "@/contract/types";
import { shiftDekad } from "@/lib/domain/dekads";

export const GOOD_WINDOW_P = 0.7;

function round3(x: number) {
  return Math.round(x * 1000) / 1000;
}

/** Highest mean p over any 3 consecutive dekads (wrapping): the ranking score. */
export function rankingScore(p: DekadProbability[]) {
  let best = 0;
  for (let d = 1; d <= 36; d++) {
    const mean = (p[d - 1].p + p[shiftDekad(d, 1) - 1].p + p[shiftDekad(d, 2) - 1].p) / 3;
    best = Math.max(best, mean);
  }
  return best;
}

/**
 * Contiguous runs of dekads with p >= 0.7, best first (max 2). When no dekad
 * reaches 0.7, returns the best 3-dekad run so the card still shows a window.
 */
export function bestWindows(p: DekadProbability[]): PlantingWindow[] {
  const good = p.map((x) => x.p >= GOOD_WINDOW_P);
  const runs: { start: number; end: number }[] = [];
  if (good.every(Boolean)) {
    runs.push({ start: 1, end: 36 });
  } else {
    // start scanning right after a "bad" dekad so runs never get split at the year boundary
    const firstBad = good.findIndex((g) => !g) + 1;
    let current = null as { start: number; end: number } | null;
    for (let k = 1; k <= 36; k++) {
      const d = shiftDekad(firstBad, k);
      if (good[d - 1]) {
        current = current ? { start: current.start, end: d } : { start: d, end: d };
      } else if (current) {
        runs.push(current);
        current = null;
      }
    }
    if (current) runs.push(current);
  }

  const withMean = runs.map(({ start, end }) => {
    const ds: number[] = [];
    for (let d = start; ; d = shiftDekad(d, 1)) {
      ds.push(d);
      if (d === end) break;
    }
    const mean = ds.reduce((s, d) => s + p[d - 1].p, 0) / ds.length;
    return { start_dekad: start, end_dekad: end, mean_p: round3(mean) };
  });

  if (withMean.length > 0) {
    return withMean.sort((a, b) => b.mean_p - a.mean_p || a.start_dekad - b.start_dekad).slice(0, 2);
  }

  let bestStart = 1;
  let bestMean = -1;
  for (let d = 1; d <= 36; d++) {
    const mean = (p[d - 1].p + p[shiftDekad(d, 1) - 1].p + p[shiftDekad(d, 2) - 1].p) / 3;
    if (mean > bestMean) {
      bestMean = mean;
      bestStart = d;
    }
  }
  return [{ start_dekad: bestStart, end_dekad: shiftDekad(bestStart, 2), mean_p: round3(bestMean) }];
}

export function bestDekad(p: DekadProbability[]) {
  let best = 1;
  for (let d = 2; d <= 36; d++) if (p[d - 1].p > p[best - 1].p) best = d;
  return best;
}
