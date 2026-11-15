/**
 * Confidence rule from plan v2, section 6 (a rule, not an invented number):
 * - high:   engine and ZARC agree on the best dekad and the crop passed the gate;
 * - medium: they agree only on the range, or the point is not the municipality centroid;
 * - low:    the crop did not pass the gate, or data is missing.
 * Every level carries its reasons.
 */
import type { Confidence, DekadProbability, Zarc } from "@/contract/types";
import type { Locale } from "@/i18n";
import { dekadLabel } from "@/lib/domain/dekads";
import { mockMessages } from "./messages";
import { bestDekad } from "./windows";

export function confidenceFor(input: {
  gatePassed: boolean;
  p: DekadProbability[];
  zarc: Zarc | null;
  nearCentroid: boolean;
  locale?: Locale;
}): Confidence {
  const locale = input.locale ?? "en";
  const t = mockMessages(locale).confidence;
  if (!input.gatePassed) {
    return { level: "low", reasons: [t.gateFailed] };
  }
  if (!input.zarc) {
    return { level: "low", reasons: [t.noZarc] };
  }

  const best = bestDekad(input.p);
  const value = input.zarc.values[best - 1];
  const recommended = input.zarc.values.filter((v) => v > 0);
  const bestZarcValue = recommended.length > 0 ? Math.min(...recommended) : 0;
  const reasons: string[] = [];
  let level: Confidence["level"];

  if (value > 0 && value === bestZarcValue) {
    level = "high";
    reasons.push(t.bestClass(dekadLabel(best, locale), value));
  } else if (value > 0) {
    level = "medium";
    reasons.push(t.inside(dekadLabel(best, locale)));
  } else {
    level = "low";
    reasons.push(t.outside(dekadLabel(best, locale)));
  }

  if (!input.nearCentroid) {
    if (level === "high") level = "medium";
    reasons.push(t.otherCell);
  }
  return { level, reasons };
}
