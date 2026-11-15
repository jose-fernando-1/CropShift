/**
 * Confidence rule from plan v2, section 6 (a rule, not an invented number):
 * - high:   engine and ZARC agree on the best dekad and the crop passed the gate;
 * - medium: they agree only on the range, or the point is not the municipality centroid;
 * - low:    the crop did not pass the gate, or data is missing.
 * Every level carries its reasons.
 */
import type { Confidence, DekadProbability, Zarc } from "@/contract/types";
import { dekadLabel } from "@/lib/domain/dekads";
import { bestDekad } from "./windows";

export function confidenceFor(input: {
  gatePassed: boolean;
  p: DekadProbability[];
  zarc: Zarc | null;
  nearCentroid: boolean;
}): Confidence {
  if (!input.gatePassed) {
    return { level: "low", reasons: ["The crop did not pass the quality gate against ZARC."] };
  }
  if (!input.zarc) {
    return { level: "low", reasons: ["No official ZARC window to compare the engine with."] };
  }

  const best = bestDekad(input.p);
  const value = input.zarc.values[best - 1];
  const recommended = input.zarc.values.filter((v) => v > 0);
  const bestZarcValue = recommended.length > 0 ? Math.min(...recommended) : 0;
  const reasons: string[] = [];
  let level: Confidence["level"];

  if (value > 0 && value === bestZarcValue) {
    level = "high";
    reasons.push(`The engine's best dekad (${dekadLabel(best)}) is in ZARC's best class (value ${value}).`);
  } else if (value > 0) {
    level = "medium";
    reasons.push(`The engine's best dekad (${dekadLabel(best)}) is inside the ZARC window, but not in its best class.`);
  } else {
    level = "low";
    reasons.push(`The engine's best dekad (${dekadLabel(best)}) is outside the ZARC window.`);
  }

  if (!input.nearCentroid) {
    if (level === "high") level = "medium";
    reasons.push("Your point is in a different climate cell than the municipality centroid.");
  }
  return { level, reasons };
}
