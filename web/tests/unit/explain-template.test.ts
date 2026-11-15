import { describe, expect, it } from "vitest";
import * as S from "@/contract/schemas";
import { templateExplanation } from "@/lib/explain/template";
import { buildRecommendation } from "@/mocks/build-recommendation";
import { municipalityByCode } from "@/mocks/data";

const rec = buildRecommendation(
  {
    code: "2613008",
    soil: 2,
    soilSource: "default",
    regime: "rainfed",
    regimeSource: "user",
    inputMode: "municipality",
    nearCentroid: true,
  },
  municipalityByCode.get("2613008")!,
);

describe("template explanation", () => {
  const ex = templateExplanation(rec);

  it("is contract-valid and names the top crops and exclusions", () => {
    S.Explanation.parse(ex);
    const text = ex.sections.flatMap((s) => s.paragraphs).join(" ");
    for (const c of rec.crops) expect(text).toContain(c.name);
    expect(text).toContain("Castor bean");
    expect(text).toMatch(/default was used/);
  });

  it("only uses percentages that exist in the payload", () => {
    const allowed = new Set(rec.crops.flatMap((c) => c.best_windows.map((w) => Math.round(w.mean_p * 100))));
    const text = ex.sections.flatMap((s) => s.paragraphs).join(" ");
    const used = [...text.matchAll(/(\d+)%/g)].map((m) => Number(m[1]));
    expect(used.length).toBeGreaterThan(0);
    for (const n of used) expect(allowed.has(n)).toBe(true);
  });
});
