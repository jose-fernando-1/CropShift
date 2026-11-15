/**
 * Synthetic probability of success per dekad. MOCK ONLY: this stands in for
 * track A's precomputed water-balance table until it exists. Deterministic:
 * the same inputs always give the same curve.
 */
import { shiftDekad } from "@/lib/domain/dekads";

export const SEASONS = 40;

/** Small seeded PRNG (mulberry32) so results are reproducible. */
export function seededRandom(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Wilson score interval (95%) for k successes in n seasons. */
export function wilson(p: number, n = SEASONS, z = 1.96) {
  const denom = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return { lo: clamp01(centre - half), hi: clamp01(centre + half) };
}

export function clamp01(x: number) {
  return Math.min(1, Math.max(0, x));
}

/** Snap to a whole number of seasons out of 40, like the real engine output. */
export function snapToSeasons(p: number) {
  return Math.round(clamp01(p) * SEASONS) / SEASONS;
}

/** Circular distance (in dekads) from `d` to the nearest dekad in `window`; 0 inside. */
function distanceToWindow(d: number, window: Set<number>) {
  if (window.has(d)) return 0;
  for (let k = 1; k <= 18; k++) {
    if (window.has(shiftDekad(d, k)) || window.has(shiftDekad(d, -k))) return k;
  }
  return 18;
}

const SOIL_FACTOR: Record<number, number> = { 1: 0.86, 2: 0.96, 3: 1.0 };

/**
 * Curve shaped by a reference window: high and flat inside, logistic fall-off
 * outside. `quality` gives a per-dekad weight inside the window (ZARC 20 > 30 > 40).
 */
export function synthCurve(opts: {
  window: number[];
  quality?: (dekad: number) => number;
  seed: string;
  soil: number;
  irrigated: boolean;
  /** Upper bound for the curve, e.g. low when ZARC recommends no dekad at all. */
  ceiling?: number;
}) {
  const rand = seededRandom(opts.seed);
  const window = new Set(opts.window);
  const peak = Math.min(opts.ceiling ?? 1, opts.irrigated ? 0.97 : 0.86 + rand() * 0.1);
  const sigma = opts.irrigated ? 2.2 : 0.9 + rand() * 0.5;
  const soil = opts.irrigated ? 1 : (SOIL_FACTOR[opts.soil] ?? 1);
  return Array.from({ length: 36 }, (_, i) => {
    const d = i + 1;
    const dist = distanceToWindow(d, window);
    const shape = dist === 0 ? (opts.quality?.(d) ?? 1) : 0.75 * Math.exp(-(dist * dist) / (2 * sigma * sigma));
    const jitter = (rand() - 0.5) * 0.05;
    return snapToSeasons(peak * shape * soil + jitter);
  });
}

/** Scale an existing curve for another soil class (prototype values are for the 0.11 m³/m³ assumption ≈ class 2). */
export function scaleForSoil(curve: number[], soil: number) {
  const factor = (SOIL_FACTOR[soil] ?? 1) / SOIL_FACTOR[2];
  return curve.map((p) => snapToSeasons(p * factor));
}

/** Contiguous window list from a top-dekad list, widened by `pad` on each side. */
export function windowAround(dekads: number[], pad: number) {
  const lo = Math.min(...dekads) - pad;
  const hi = Math.max(...dekads) + pad;
  const out: number[] = [];
  for (let d = lo; d <= hi; d++) out.push(shiftDekad(d, 0));
  return out;
}
