/**
 * Deterministic explanation built only from the Recommendation JSON. Used by
 * the mock /explain route and by the client when /explain fails, so the app
 * always works without AI (plan v2, section 7). It never introduces a number
 * that is not in the payload.
 */
import type { Explanation, Recommendation } from "@/contract/types";
import { windowLabel } from "@/lib/domain/dekads";
import { CONFIDENCE_LABELS, percent, REGIME_LABELS, SOIL_LABELS } from "@/lib/domain/format";

export const FIELD_CHECKS = [
  "Get a soil analysis: texture, depth and fertility change how much water the crop can use.",
  "Check local market prices and buyers before choosing a crop.",
  "Ask about pests and diseases this season with your local extension office.",
  "Compare with the local planting calendar and your own experience of the rains.",
];

export function templateExplanation(rec: Recommendation, now = new Date()): Explanation {
  const { location } = rec;
  const top = rec.crops.slice(0, 3);
  const defaults = [
    location.soil_source === "default" ? "soil class" : null,
    location.regime_source === "default" ? "regime" : null,
  ].filter(Boolean);

  const summary = [
    `For ${location.municipality_name}, with ${SOIL_LABELS[location.soil_class].toLowerCase()} soil and ${REGIME_LABELS[location.regime].toLowerCase()} farming, ` +
      (top.length > 0
        ? `the crops with the best simulated planting windows are: ${top.map((c) => c.name).join(", ")}.`
        : "no crop passed the quality checks, so there is no ranking."),
  ];
  if (defaults.length > 0) {
    summary.push(`You did not choose a ${defaults.join(" or ")}, so the default was used. Change it above to see how the result moves.`);
  }

  const cropParagraphs = top.map((c) => {
    const [best] = c.best_windows;
    const window = best
      ? `The best window is ${windowLabel(best.start_dekad, best.end_dekad)}, where planting succeeded in ${percent(best.mean_p)} of simulated seasons on average.`
      : "There is no clear planting window.";
    const zarc = c.zarc
      ? "The official ZARC window is shown on the chart for comparison."
      : "There is no official ZARC window to compare with.";
    return `${c.rank}. ${c.name}: ${window} ${zarc} Confidence is ${CONFIDENCE_LABELS[c.confidence.level].toLowerCase()}: ${c.confidence.reasons.join(" ")}`;
  });

  const excluded = rec.excluded.map((e) => `${e.name}: ${e.reason}`);

  const sections = [
    { id: "summary", title: "Summary", paragraphs: summary },
    { id: "top", title: "Top crops", paragraphs: cropParagraphs.length > 0 ? cropParagraphs : ["No crop is ranked."] },
  ];
  if (excluded.length > 0) {
    sections.push({ id: "excluded", title: "Not ranked", paragraphs: excluded });
  }
  sections.push({
    id: "limits",
    title: "How sure is this",
    paragraphs: [
      "These are probabilities from past seasons of NASA climate data, not a forecast. They describe a climate cell, not your field.",
      "This is decision support: it does not replace your own judgement.",
    ],
  });

  return {
    analysis_id: rec.analysis_id,
    source: "template",
    mock: rec.mock,
    generated_at: now.toISOString(),
    sections,
    field_checks: FIELD_CHECKS,
  };
}
