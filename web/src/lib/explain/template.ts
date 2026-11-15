/**
 * Deterministic explanation built only from the Recommendation JSON. Used by
 * the mock /explain route and by the client when /explain fails, so the app
 * always works without AI (plan v2, section 7). It never introduces a number
 * that is not in the payload.
 */
import type { Explanation, Recommendation } from "@/contract/types";
import { getMessages, type Locale } from "@/i18n";
import { windowLabel } from "@/lib/domain/dekads";
import { percent } from "@/lib/domain/format";

export function fieldChecks(locale: Locale = "en") {
  return getMessages(locale).template.fieldChecks;
}

export function templateExplanation(rec: Recommendation, now = new Date(), locale: Locale = "en"): Explanation {
  const m = getMessages(locale);
  const t = m.template;
  const { location } = rec;
  const top = rec.crops.slice(0, 3);
  const defaults = [
    location.soil_source === "default" ? t.defaultSoil : null,
    location.regime_source === "default" ? t.defaultRegime : null,
  ].filter((x): x is string => x !== null);

  const summary = [
    t.intro(location.municipality_name, m.labels.soil[location.soil_class], t.regimePhrase[location.regime]) +
      (top.length > 0 ? t.topList(top.map((c) => c.name).join(", ")) : t.noRanking),
  ];
  if (defaults.length > 0) summary.push(t.defaults(defaults));

  const cropParagraphs = top.map((c) => {
    const [best] = c.best_windows;
    const window = best ? t.window(windowLabel(best.start_dekad, best.end_dekad, locale), percent(best.mean_p)) : t.noWindow;
    const zarc = c.zarc ? t.zarc : t.noZarc;
    return `${c.rank}. ${c.name}: ${window} ${zarc} ${t.confidence(m.labels.confidence[c.confidence.level], c.confidence.reasons.join(" "))}`;
  });

  const excluded = rec.excluded.map((e) => `${e.name}: ${e.reason}`);

  const sections = [
    { id: "summary", title: t.summary, paragraphs: summary },
    { id: "top", title: t.top, paragraphs: cropParagraphs.length > 0 ? cropParagraphs : [t.noneRanked] },
  ];
  if (excluded.length > 0) sections.push({ id: "excluded", title: t.notRanked, paragraphs: excluded });
  sections.push({ id: "limits", title: t.howSure, paragraphs: [...t.limits] });

  return {
    analysis_id: rec.analysis_id,
    source: "template",
    mock: rec.mock,
    generated_at: now.toISOString(),
    sections,
    field_checks: [...t.fieldChecks],
  };
}
