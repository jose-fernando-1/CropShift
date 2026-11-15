import { describe, expect, it } from "vitest";
import * as S from "@/contract/schemas";
import { buildRecommendation, decodeAnalysisId, encodeAnalysisId, type AnalysisParams } from "@/mocks/build-recommendation";
import { confidenceFor } from "@/mocks/confidence";
import { municipalities, municipalityByCode } from "@/mocks/data";
import { findMunicipality } from "@/mocks/resolve";
import { wilson } from "@/mocks/synth";
import { bestWindows } from "@/mocks/windows";

const SBU = "2613008";
const params = (over: Partial<AnalysisParams> = {}): AnalysisParams => ({
  code: SBU,
  soil: 2,
  soilSource: "user",
  regime: "rainfed",
  regimeSource: "user",
  inputMode: "municipality",
  nearCentroid: true,
  ...over,
});
const build = (over: Partial<AnalysisParams> = {}) => buildRecommendation(params(over), municipalityByCode.get(over.code ?? SBU)!);

describe("point resolution", () => {
  it("resolves the prototype point to São Bento do Una", () => {
    expect(findMunicipality(-8.6, -36.4)?.code).toBe(SBU);
  });
  it("returns null outside Pernambuco", () => {
    expect(findMunicipality(-12.97, -38.5)).toBeNull(); // Salvador, BA
    expect(findMunicipality(-8.05, -34.0)).toBeNull(); // Atlantic, off Recife
  });
  it("covers all 185 municipalities", () => {
    expect(municipalities).toHaveLength(185);
  });
});

describe("golden prototype values (plan v2, section 9)", () => {
  it("cowpea in São Bento do Una, medium soil, rainfed", () => {
    const cowpea = build().crops.find((c) => c.crop_id === "cowpea")!;
    const p = cowpea.p_success.map((x) => x.p);
    expect(p[12 - 1]).toBe(1);
    expect(p[20 - 1]).toBe(0.25);
    for (let d = 23; d <= 32; d++) expect(p[d - 1]).toBeLessThanOrEqual(0.02);
  });
});

describe("recommendation", () => {
  it("is valid against the contract for every municipality, soil and regime", () => {
    for (const m of municipalities) {
      for (const soil of [1, 2, 3] as const) {
        for (const regime of ["rainfed", "irrigated"] as const) {
          const rec = buildRecommendation(params({ code: m.code, soil, regime }), m);
          const parsed = S.Recommendation.safeParse(rec);
          if (!parsed.success) throw new Error(`${m.code}/${soil}/${regime}: ${parsed.error.message}`);
        }
      }
    }
  });

  it("is deterministic apart from generated_at", () => {
    const a = build();
    const b = build();
    expect({ ...a, generated_at: "" }).toEqual({ ...b, generated_at: "" });
  });

  it("ranks only gate-passed crops and lists the rest as excluded", () => {
    const rec = build();
    expect(rec.crops.map((c) => c.crop_id).sort()).toEqual(["cowpea", "peanut", "sorghum"]);
    expect(rec.crops.map((c) => c.rank)).toEqual([1, 2, 3]);
    const castor = rec.excluded.find((e) => e.crop_id === "castor")!;
    expect(castor.reason_code).toBe("gate_failed");
    const ids = new Set(rec.crops.map((c) => c.crop_id));
    expect(rec.excluded.every((e) => !ids.has(e.crop_id))).toBe(true);
  });

  it("has no ZARC when irrigated and says why", () => {
    const rec = build({ regime: "irrigated" });
    for (const c of rec.crops) {
      expect(c.zarc).toBeNull();
      expect(c.confidence.level).toBe("low");
      expect(c.missing_data.join(" ")).toMatch(/irrigated ZARC/);
    }
  });

  it("encodes and decodes the analysis id", () => {
    const p = params({ soil: 3, soilSource: "default", inputMode: "point", nearCentroid: false });
    expect(decodeAnalysisId(encodeAnalysisId(p))).toEqual(p);
    expect(decodeAnalysisId("nope")).toBeNull();
  });
});

describe("helpers", () => {
  it("wilson band contains p and stays in [0, 1]", () => {
    for (const p of [0, 0.25, 0.5, 1]) {
      const { lo, hi } = wilson(p);
      expect(lo).toBeLessThanOrEqual(p);
      expect(hi).toBeGreaterThanOrEqual(p);
      expect(lo).toBeGreaterThanOrEqual(0);
      expect(hi).toBeLessThanOrEqual(1);
    }
  });

  it("best windows join runs across the year end", () => {
    const p = Array.from({ length: 36 }, (_, i) => ({ p: i < 2 || i > 33 ? 0.9 : 0.1, lo: 0, hi: 1 }));
    expect(bestWindows(p)[0]).toMatchObject({ start_dekad: 35, end_dekad: 2 });
  });

  it("confidence follows the plan's rule", () => {
    const p = Array.from({ length: 36 }, (_, i) => ({ p: i === 11 ? 1 : 0.1, lo: 0, hi: 1 }));
    const zarc = { values: Array.from({ length: 36 }, (_, i) => (i === 11 ? 20 : i === 12 ? 30 : 0)) as (0 | 20 | 30 | 40)[], cycle_code: "21", soil_code: 2, ordinance: "x", season: "2025/2026" };
    expect(confidenceFor({ gatePassed: true, p, zarc, nearCentroid: true }).level).toBe("high");
    expect(confidenceFor({ gatePassed: true, p, zarc, nearCentroid: false }).level).toBe("medium");
    expect(confidenceFor({ gatePassed: false, p, zarc, nearCentroid: true }).level).toBe("low");
    expect(confidenceFor({ gatePassed: true, p, zarc: null, nearCentroid: true }).level).toBe("low");
  });
});
