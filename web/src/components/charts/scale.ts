/**
 * Sequential single-hue ramp (blue) for probability of success. The lightest
 * step means "near zero" and recedes toward the surface.
 */
export const PROBABILITY_STEPS = [
  { min: 0, color: "var(--seq-0)", ink: "var(--ink-2)" },
  { min: 0.1, color: "var(--seq-100)", ink: "var(--ink)" },
  { min: 0.25, color: "var(--seq-200)", ink: "var(--ink)" },
  { min: 0.4, color: "var(--seq-300)", ink: "var(--ink)" },
  { min: 0.55, color: "var(--seq-400)", ink: "#fff" },
  { min: 0.7, color: "var(--seq-500)", ink: "#fff" },
  { min: 0.85, color: "var(--seq-600)", ink: "#fff" },
  { min: 0.95, color: "var(--seq-700)", ink: "#fff" },
] as const;

export function probabilityStep(p: number) {
  let step: (typeof PROBABILITY_STEPS)[number] = PROBABILITY_STEPS[0];
  for (const s of PROBABILITY_STEPS) if (p >= s.min) step = s;
  return step;
}
