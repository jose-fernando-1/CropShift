/**
 * Builds a contract-valid Recommendation from the mock fixtures. MOCK ONLY:
 * the real version lives in the FastAPI backend and reads track A's table.
 */
import { CONTRACT_VERSION } from "@/contract/schemas";
import type { DekadProbability, ExcludedCrop, Pam, RankedCrop, Recommendation, Regime, SoilClass, Source, Zarc } from "@/contract/types";
import type { Locale } from "@/i18n";
import { windowLabel, dekadLabel } from "@/lib/domain/dekads";
import { kgPerHa, percent } from "@/lib/domain/format";
import { confidenceFor } from "./confidence";
import { mockMessages } from "./messages";
import { catalog, pamFor, pamYears, prototype, zarcFor, zarcSeason, type CatalogCrop, type MunicipalityRecord } from "./data";
import { scaleForSoil, synthCurve, wilson, windowAround } from "./synth";
import { bestWindows, GOOD_WINDOW_P, rankingScore } from "./windows";

export type AnalysisParams = {
  code: string;
  soil: SoilClass;
  soilSource: "user" | "default";
  regime: Regime;
  regimeSource: "user" | "default";
  inputMode: "point" | "municipality";
  nearCentroid: boolean;
};

/* ---------- analysis id: opaque to clients, decodable by the mock ---------- */

export function encodeAnalysisId(p: AnalysisParams) {
  const raw = [p.code, p.soil, p.soilSource[0], p.regime[0], p.regimeSource[0], p.inputMode[0], p.nearCentroid ? 1 : 0].join(".");
  return `csm_${catalog.data_version.replace(/[^0-9]/g, "")}_${raw}`;
}

export function decodeAnalysisId(id: string): AnalysisParams | null {
  const m = /^csm_\d+_(\d{7})\.([123])\.([ud])\.([ri])\.([ud])\.([pm])\.([01])$/.exec(id);
  if (!m) return null;
  return {
    code: m[1],
    soil: Number(m[2]) as SoilClass,
    soilSource: m[3] === "u" ? "user" : "default",
    regime: m[4] === "r" ? "rainfed" : "irrigated",
    regimeSource: m[5] === "u" ? "user" : "default",
    inputMode: m[6] === "p" ? "point" : "municipality",
    nearCentroid: m[7] === "1",
  };
}

/* ---------- sources ---------- */

const RETRIEVED = "2026-11-14";

export const SOURCES = {
  power: {
    id: "nasa-power",
    name: "NASA POWER daily (1984–2024)",
    url: "https://power.larc.nasa.gov/docs/services/api/temporal/daily/",
    version: "daily, 0.5° × 0.625°",
  },
  zarc: {
    id: "zarc",
    name: `MAPA ZARC risk table, season ${zarcSeason}`,
    url: "https://dados.agricultura.gov.br/dataset/tabua-de-risco-zoneamento-agricola-de-risco-climatico",
    version: zarcSeason,
  },
  pam: {
    id: "ibge-pam",
    name: `IBGE PAM yield, ${pamYears[0]}–${pamYears[1]}`,
    url: "https://sidra.ibge.gov.br/tabela/5457",
    version: `${pamYears[0]}-${pamYears[1]}`,
  },
  fao56: {
    id: "fao56",
    name: "FAO-56 crop coefficients and stage lengths",
    url: "https://www.fao.org/4/x0490e/x0490e00.htm",
    version: null,
  },
} satisfies Record<string, Source>;

const DATASET_VERSIONS = [
  { name: "NASA POWER daily", version: "1984-2024", retrieved_at: RETRIEVED },
  { name: "MAPA ZARC", version: zarcSeason, retrieved_at: RETRIEVED },
  { name: "IBGE PAM", version: `${pamYears[0]}-${pamYears[1]}`, retrieved_at: RETRIEVED },
  { name: "IBGE municipal mesh v3", version: "qualidade=minima", retrieved_at: RETRIEVED },
  { name: "FAO-56 / EcoCrop crop sheet", version: "v1", retrieved_at: RETRIEVED },
];

const DISCLAIMER_IDS = ["mock", "scale", "soil", "rain", "validation", "zarc", "dekad"] as const;

function disclaimers(locale: Locale) {
  const text = mockMessages(locale).disclaimers;
  return DISCLAIMER_IDS.map((id) => ({ id, text: text[id] }));
}

/** Source entries whose titles are our own text, so they follow the language (dataset names stay as published). */
function localSources(locale: Locale): Record<"prototype" | "synthetic", Source> {
  const t = mockMessages(locale).sources;
  return {
    prototype: { id: "prototype", name: t.prototype, url: null, version: catalog.method_version },
    synthetic: { id: "mock-synthetic", name: t.synthetic, url: null, version: catalog.data_version },
  };
}

/* ---------- curves ---------- */

const ZARC_QUALITY: Record<number, number> = { 20: 1, 30: 0.93, 40: 0.85 };

function zarcWindow(z: Zarc | null) {
  return z ? z.values.flatMap((v, i) => (v > 0 ? [i + 1] : [])) : [];
}

function curveFor(crop: CatalogCrop, p: AnalysisParams, zarc: Zarc | null, locale: Locale): { p: number[]; source: Source } {
  const sources = localSources(locale);
  const seed = `${p.code}:${crop.crop_id}:${p.soil}:${p.regime}`;
  const irrigated = p.regime === "irrigated";
  const isPrototypePoint = p.code === prototype.municipality_code && !irrigated;

  if (isPrototypePoint && crop.crop_id === "cowpea") {
    return { p: scaleForSoil(prototype.cowpea, p.soil), source: sources.prototype };
  }
  const summary = prototype.summaries[crop.crop_id];
  if (isPrototypePoint && summary) {
    const quality = (d: number) => ZARC_QUALITY[zarc?.values[d - 1] ?? 20] ?? 0.8;
    return { p: synthCurve({ window: windowAround(summary.top5, 3), quality, seed, soil: p.soil, irrigated }), source: sources.synthetic };
  }

  let window = zarcWindow(zarc);
  let ceiling: number | undefined;
  if (zarc && window.length === 0) {
    // ZARC exists but recommends no dekad here: keep the simulated chance low everywhere.
    window = windowAround([9, 18], 0);
    ceiling = 0.4;
  } else if (window.length === 0) {
    // No ZARC for this request (irrigated, or no rainfed table): shape around the rainfed medium-soil window.
    const reference = zarcWindow(zarcFor(p.code, crop.crop_id, 2));
    window = reference.length > 0 ? windowAround(reference, 2) : windowAround([9, 18], 0);
  }
  const quality = zarc ? (d: number) => ZARC_QUALITY[zarc.values[d - 1]] ?? 1 : undefined;
  return { p: synthCurve({ window, quality, seed, soil: p.soil, irrigated, ceiling }), source: sources.synthetic };
}

function withBands(values: number[]): DekadProbability[] {
  return values.map((p) => {
    const { lo, hi } = wilson(p);
    return { p, lo: Math.round(lo * 1000) / 1000, hi: Math.round(hi * 1000) / 1000 };
  });
}

/* ---------- narrative bullets (every number comes from the payload) ---------- */

function strengthsFor(crop: CatalogCrop, probs: DekadProbability[], zarc: Zarc | null, locale: Locale) {
  const t = mockMessages(locale).strengths;
  const out: string[] = [];
  const [best] = bestWindows(probs);
  if (best && best.mean_p >= GOOD_WINDOW_P) {
    out.push(t.window(windowLabel(best.start_dekad, best.end_dekad, locale), percent(best.mean_p)));
  }
  if (zarc && best && zarc.values[best.start_dekad - 1] > 0 && zarc.values[best.end_dekad - 1] > 0) {
    out.push(t.insideZarc);
  }
  if (crop.legume) out.push(t.legume);
  return out;
}

function risksFor(probs: DekadProbability[], zarc: Zarc | null, pam: Pam | null, p: AnalysisParams, locale: Locale) {
  const t = mockMessages(locale).risks;
  const out: string[] = [];
  const good = probs.filter((x) => x.p >= GOOD_WINDOW_P).length;
  if (good > 0 && good <= 4) out.push(t.narrow(good));
  if (good === 0) out.push(t.none);
  const [best] = bestWindows(probs);
  if (best) {
    const after = (best.end_dekad % 36) + 1;
    if (probs[after - 1].p < 0.5) out.push(t.late(dekadLabel(after, locale)));
  }
  if (zarc) {
    const outside = probs.filter((x, i) => zarc.values[i] === 0 && x.p >= GOOD_WINDOW_P).length;
    if (outside > 0) out.push(t.outsideZarc(outside));
  }
  if (pam?.municipality_median != null && pam.state_median != null && pam.municipality_median < pam.state_median) {
    out.push(t.lowYield(kgPerHa(pam.municipality_median, locale), kgPerHa(pam.state_median, locale)));
  }
  if (p.soil === 1 && p.regime === "rainfed") out.push(t.sandy);
  return out;
}

function missingFor(crop: CatalogCrop, zarc: Zarc | null, pam: Pam | null, p: AnalysisParams, locale: Locale) {
  const t = mockMessages(locale).missing;
  const out: string[] = [];
  if (!zarc) {
    out.push(p.regime === "irrigated" ? t.irrigated : crop.crop_id === "common_bean" ? t.commonBean : t.noZarc);
  }
  if (!pam) out.push(crop.pam_crop ? t.noPam : t.notSurveyed);
  out.push(t.soilAssumed);
  return out;
}

/** Crop name in the requested language (catalog.json holds the English names). */
export function cropName(crop: CatalogCrop, locale: Locale) {
  return mockMessages(locale).cropNames[crop.crop_id] ?? crop.name;
}

/* ---------- main ---------- */

export function buildRecommendation(
  p: AnalysisParams,
  municipality: MunicipalityRecord,
  now = new Date(),
  locale: Locale = "en",
): Recommendation {
  const mm = mockMessages(locale);
  const ranked: Omit<RankedCrop, "rank">[] = [];
  const excluded: ExcludedCrop[] = [];

  for (const crop of catalog.crops) {
    const zarc = p.regime === "rainfed" ? zarcFor(p.code, crop.crop_id, p.soil) : null;
    const pam = pamFor(p.code, crop.pam_crop);
    const baseSources = [SOURCES.power, ...(zarc ? [SOURCES.zarc] : []), ...(pam ? [SOURCES.pam] : []), SOURCES.fao56];

    if (crop.gate.status !== "passed") {
      excluded.push({
        crop_id: crop.crop_id,
        name: cropName(crop, locale),
        eligible: false,
        reason_code: crop.gate.status === "failed" ? "gate_failed" : "engine_not_run",
        reason: crop.gate.status === "failed" ? mm.excluded.gateFailed(crop.gate.value) : mm.excluded.notRun,
        zarc,
        pam,
        sources: baseSources,
      });
      continue;
    }

    const curve = curveFor(crop, p, zarc, locale);
    const probs = withBands(curve.p);
    ranked.push({
      crop_id: crop.crop_id,
      name: cropName(crop, locale),
      eligible: true,
      legume: crop.legume,
      best_windows: bestWindows(probs),
      p_success: probs,
      zarc,
      pam,
      flags: { engine_reliable: true, ml_applied: false },
      strengths: strengthsFor(crop, probs, zarc, locale),
      risks: risksFor(probs, zarc, pam, p, locale),
      missing_data: missingFor(crop, zarc, pam, p, locale),
      sources: [...baseSources, curve.source],
      confidence: confidenceFor({ gatePassed: true, p: probs, zarc, nearCentroid: p.nearCentroid, locale }),
    });
  }

  const crops: RankedCrop[] = ranked
    .map((c) => ({ c, score: rankingScore(c.p_success) }))
    .sort((a, b) => b.score - a.score || a.c.crop_id.localeCompare(b.c.crop_id))
    .map(({ c }, i) => ({ ...c, rank: i + 1 }));

  return {
    analysis_id: encodeAnalysisId(p),
    contract_version: CONTRACT_VERSION,
    method_version: catalog.method_version,
    dataset_versions: DATASET_VERSIONS,
    mock: true,
    generated_at: now.toISOString(),
    location: {
      municipality_code: municipality.code,
      municipality_name: municipality.name,
      power_cell: municipality.power_cell,
      soil_class: p.soil,
      soil_source: p.soilSource,
      regime: p.regime,
      regime_source: p.regimeSource,
      input_mode: p.inputMode,
      municipality_centroid: municipality.centroid,
      near_centroid: p.nearCentroid,
    },
    crops,
    excluded,
    disclaimers: disclaimers(locale),
  };
}
