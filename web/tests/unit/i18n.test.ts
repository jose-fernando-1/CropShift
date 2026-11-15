import { describe, expect, it } from "vitest";
import * as S from "@/contract/schemas";
import { getMessages, localeFromAcceptLanguage } from "@/i18n";
import { en } from "@/i18n/messages/en";
import { dekadLabel, windowLabel } from "@/lib/domain/dekads";
import { kgPerHa } from "@/lib/domain/format";
import { templateExplanation } from "@/lib/explain/template";
import { buildRecommendation, type AnalysisParams } from "@/mocks/build-recommendation";
import { municipalityByCode } from "@/mocks/data";
import { handleMock } from "@/mocks/handlers";

const SBU = "2613008";
const params: AnalysisParams = { code: SBU, soil: 1, soilSource: "user", regime: "rainfed", regimeSource: "default", inputMode: "point", nearCentroid: false };
const build = (locale: "en" | "pt-BR") => buildRecommendation(params, municipalityByCode.get(SBU)!, new Date(0), locale);

/** Every leaf key path of a message object (functions count as leaves). */
function keyPaths(obj: unknown, prefix = ""): string[] {
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) return [prefix];
  return Object.entries(obj).flatMap(([k, v]) => keyPaths(v, prefix ? `${prefix}.${k}` : k));
}

describe("locale negotiation", () => {
  it.each([
    [null, "en"],
    ["pt-BR,pt;q=0.9,en;q=0.8", "pt-BR"],
    ["pt", "pt-BR"],
    ["en-US,en;q=0.9", "en"],
    ["fr-FR", "en"],
  ] as const)("%s -> %s", (header, expected) => {
    expect(localeFromAcceptLanguage(header)).toBe(expected);
  });
});

describe("message catalogs", () => {
  it("pt-BR has every key the English catalog has, with the same list lengths", () => {
    const pt = getMessages("pt-BR");
    expect(keyPaths(pt).sort()).toEqual(keyPaths(en).sort());
    expect(pt.months).toHaveLength(12);
    expect(pt.limits.items).toHaveLength(en.limits.items.length);
    expect(pt.template.fieldChecks).toHaveLength(en.template.fieldChecks.length);
  });

  it("formats dekads and numbers per locale", () => {
    expect(dekadLabel(12, "pt-BR")).toBe("abr 21–30");
    expect(windowLabel(12, 15, "pt-BR")).toBe("abr 21 – mai 31");
    expect(kgPerHa(1234.4, "pt-BR")).toBe("1.234 kg/ha");
    expect(kgPerHa(1234.4)).toBe("1,234 kg/ha");
  });
});

describe("pt-BR mock output", () => {
  it("keeps every number and id, and changes only human-readable text", () => {
    const enRec = build("en");
    const ptRec = build("pt-BR");
    S.Recommendation.parse(ptRec);
    expect(ptRec.crops.map((c) => [c.crop_id, c.rank, c.best_windows, c.p_success, c.confidence.level])).toEqual(
      enRec.crops.map((c) => [c.crop_id, c.rank, c.best_windows, c.p_success, c.confidence.level]),
    );
    expect(ptRec.analysis_id).toBe(enRec.analysis_id);
    expect(ptRec.disclaimers.map((d) => d.id)).toEqual(enRec.disclaimers.map((d) => d.id));
    expect(ptRec.crops.find((c) => c.crop_id === "cowpea")?.name).toBe("Feijão-caupi");
    expect(ptRec.excluded.find((e) => e.crop_id === "castor")?.reason).toMatch(/não confiável/);
    expect(ptRec.crops[0].confidence.reasons.join(" ")).toMatch(/decêndio/);
  });

  it("pt-BR template is valid and adds no number missing from the payload", () => {
    const rec = build("pt-BR");
    const ex = templateExplanation(rec, new Date(0), "pt-BR");
    S.Explanation.parse(ex);
    const text = ex.sections.flatMap((s) => s.paragraphs).join(" ");
    expect(text).toContain("Feijão-caupi");
    const allowed = new Set(rec.crops.flatMap((c) => c.best_windows.map((w) => Math.round(w.mean_p * 100))));
    for (const m of text.matchAll(/(\d+)%/g)) expect(allowed.has(Number(m[1]))).toBe(true);
  });

  it("the mock API honours Accept-Language and reports it", async () => {
    const res = await handleMock(
      new Request("http://test/api/v1/recommendations", {
        method: "POST",
        body: JSON.stringify({ municipality_code: SBU }),
        headers: { "content-type": "application/json", "accept-language": "pt-BR" },
      }),
      ["v1", "recommendations"],
    );
    expect(res.headers.get("content-language")).toBe("pt-BR");
    const rec = S.Recommendation.parse(await res.json());
    expect(rec.disclaimers[0].text).toMatch(/Dados de demonstração/);
  });
});

describe("Accept-Language q-values", () => {
  it.each([
    ["en;q=0.1, pt-BR;q=0.9", "pt-BR"],
    ["pt;q=0, en", "en"],
    ["pt-PT", "pt-BR"],
    ["fr, pt-BR;q=0.5", "pt-BR"],
    ["en;q=abc", "en"],
  ] as const)("%s -> %s", (header, expected) => {
    expect(localeFromAcceptLanguage(header)).toBe(expected);
  });
});

describe("pt-BR template phrasing", () => {
  it("reads naturally for irrigated farms", () => {
    const rec = buildRecommendation({ ...params, regime: "irrigated" }, municipalityByCode.get(SBU)!, new Date(0), "pt-BR");
    const text = templateExplanation(rec, new Date(0), "pt-BR").sections[0].paragraphs[0];
    expect(text).toContain("e cultivo irrigado,");
    expect(text).not.toContain("cultivo de irrigado");
  });
});
