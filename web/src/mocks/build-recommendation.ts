/**
 * Builds a contract-valid Recommendation from the mock fixtures. MOCK ONLY:
 * the real version lives in the FastAPI backend and reads track A's table.
 */
import { CONTRACT_VERSION } from "@/contract/schemas";
import type {
  DekadProbability,
  ExcludedCrop,
  Pam,
  RankedCrop,
  Recommendation,
  Regime,
  SoilClass,
  Source,
  Zarc,
} from "@/contract/types";
import { windowLabel, dekadLabel } from "@/lib/domain/dekads";
import { kgPerHa, percent } from "@/lib/domain/format";
import { confidenceFor } from "./confidence";
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
  const raw = [
    p.code,
    p.soil,
    p.soilSource[0],
    p.regime[0],
    p.regimeSource[0],
    p.inputMode[0],
    p.nearCentroid ? 1 : 0,
  ].join(".");
  return `fsm_${catalog.data_version.replace(/[^0-9]/g, "")}_${raw}`;
}

export function decodeAnalysisId(id: string): AnalysisParams | null {
  const m = /^fsm_\d+_(\d{7})\.([123])\.([ud])\.([ri])\.([ud])\.([pm])\.([01])$/.exec(id);
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
  power: { id: "nasa-power", name: "NASA POWER daily (1984–2024)", url: "https://power.larc.nasa.gov/docs/services/api/temporal/daily/", version: "daily, 0.5° × 0.625°" },
  zarc: { id: "zarc", name: `MAPA ZARC risk table, season ${zarcSeason}`, url: "https://dados.agricultura.gov.br/dataset/tabua-de-risco-zoneamento-agricola-de-risco-climatico", version: zarcSeason },
  pam: { id: "ibge-pam", name: `IBGE PAM yield, ${pamYears[0]}–${pamYears[1]}`, url: "https://sidra.ibge.gov.br/tabela/5457", version: `${pamYears[0]}-${pamYears[1]}` },
  fao56: { id: "fao56", name: "FAO-56 crop coefficients and stage lengths", url: "https://www.fao.org/4/x0490e/x0490e00.htm", version: null },
  prototype: { id: "prototype", name: "Field Shift prototype engine, São Bento do Una (digitized chart)", url: null, version: catalog.method_version },
  synthetic: { id: "mock-synthetic", name: "Synthetic mock values (not real results)", url: null, version: catalog.data_version },
} satisfies Record<string, Source>;

const DATASET_VERSIONS = [
  { name: "NASA POWER daily", version: "1984-2024", retrieved_at: RETRIEVED },
  { name: "MAPA ZARC", version: zarcSeason, retrieved_at: RETRIEVED },
  { name: "IBGE PAM", version: `${pamYears[0]}-${pamYears[1]}`, retrieved_at: RETRIEVED },
  { name: "IBGE municipal mesh v3", version: "qualidade=minima", retrieved_at: RETRIEVED },
  { name: "FAO-56 / EcoCrop crop sheet", version: "v1", retrieved_at: RETRIEVED },
];

export const DISCLAIMERS = [
  { id: "mock", text: "Demo data: success probabilities are synthetic. ZARC windows and PAM yields are real public data." },
  { id: "scale", text: "Climate comes from NASA POWER cells of 0.5° × 0.625° (about 55 × 69 km). It does not describe your field." },
  { id: "soil", text: "Soil water is an assumption (0.11 m³/m³ available water, sandy loam), not a measurement." },
  { id: "rain", text: "Rainfall is POWER's; in 2024 IMERG measured about 37% less at the test point. Results depend on the rain source." },
  { id: "validation", text: "Independent validation against PAM yields is weak to moderate (rank correlation +0.33 to +0.48, one point)." },
  { id: "zarc", text: "ZARC is also built from a water balance, so agreeing with it shows consistency with the official method, not field success." },
  { id: "dekad", text: "Dekad 1 is assumed to be Jan 1–10, and ZARC values 20/30/40 are shown as-is; their meaning as risk % is not confirmed." },
];

/* ---------- curves ---------- */

const ZARC_QUALITY: Record<number, number> = { 20: 1, 30: 0.93, 40: 0.85 };

function zarcWindow(z: Zarc | null) {
  return z ? z.values.flatMap((v, i) => (v > 0 ? [i + 1] : [])) : [];
}

function curveFor(crop: CatalogCrop, p: AnalysisParams, zarc: Zarc | null): { p: number[]; source: Source } {
  const seed = `${p.code}:${crop.crop_id}:${p.soil}:${p.regime}`;
  const irrigated = p.regime === "irrigated";
  const isPrototypePoint = p.code === prototype.municipality_code && !irrigated;

  if (isPrototypePoint && crop.crop_id === "cowpea") {
    return { p: scaleForSoil(prototype.cowpea, p.soil), source: SOURCES.prototype };
  }
  const summary = prototype.summaries[crop.crop_id];
  if (isPrototypePoint && summary) {
    const quality = (d: number) => ZARC_QUALITY[zarc?.values[d - 1] ?? 20] ?? 0.8;
    return { p: synthCurve({ window: windowAround(summary.top5, 3), quality, seed, soil: p.soil, irrigated }), source: SOURCES.synthetic };
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
  return { p: synthCurve({ window, quality, seed, soil: p.soil, irrigated, ceiling }), source: SOURCES.synthetic };
}

function withBands(values: number[]): DekadProbability[] {
  return values.map((p) => {
    const { lo, hi } = wilson(p);
    return { p, lo: Math.round(lo * 1000) / 1000, hi: Math.round(hi * 1000) / 1000 };
  });
}

/* ---------- narrative bullets (every number comes from the payload) ---------- */

function strengthsFor(crop: CatalogCrop, probs: DekadProbability[], zarc: Zarc | null) {
  const out: string[] = [];
  const [best] = bestWindows(probs);
  if (best && best.mean_p >= GOOD_WINDOW_P) {
    out.push(`${windowLabel(best.start_dekad, best.end_dekad)} succeeded in ${percent(best.mean_p)} of 40 simulated seasons on average.`);
  }
  if (zarc && best && zarc.values[best.start_dekad - 1] > 0 && zarc.values[best.end_dekad - 1] > 0) {
    out.push("The best simulated window sits inside the official ZARC window.");
  }
  if (crop.legume) out.push("Legume: it can fix nitrogen, which helps the next crop.");
  return out;
}

function risksFor(probs: DekadProbability[], zarc: Zarc | null, pam: Pam | null, p: AnalysisParams) {
  const out: string[] = [];
  const good = probs.filter((x) => x.p >= GOOD_WINDOW_P).length;
  if (good > 0 && good <= 4) out.push(`Narrow window: only ${good} ${good === 1 ? "dekad reaches" : "dekads reach"} 70% success.`);
  if (good === 0) out.push("No dekad reaches 70% success in the simulation.");
  const [best] = bestWindows(probs);
  if (best) {
    const after = ((best.end_dekad % 36) + 1);
    if (probs[after - 1].p < 0.5) {
      out.push(`Success drops below 50% from ${dekadLabel(after)}: planting late is risky.`);
    }
  }
  if (zarc) {
    const outside = probs.filter((x, i) => zarc.values[i] === 0 && x.p >= GOOD_WINDOW_P).length;
    if (outside > 0) {
      out.push(`${outside} ${outside === 1 ? "dekad looks" : "dekads look"} good in the simulation but ${outside === 1 ? "is" : "are"} outside the ZARC window.`);
    }
  }
  if (pam?.municipality_median != null && pam.state_median != null && pam.municipality_median < pam.state_median) {
    out.push(
      `Recorded yields here (median ${kgPerHa(pam.municipality_median)}) are below the state median (${kgPerHa(pam.state_median)}).`,
    );
  }
  if (p.soil === 1 && p.regime === "rainfed") out.push("Sandy soil stores less water; dry spells hurt more.");
  return out;
}

function missingFor(crop: CatalogCrop, zarc: Zarc | null, pam: Pam | null, p: AnalysisParams) {
  const out: string[] = [];
  if (!zarc) {
    out.push(
      p.regime === "irrigated"
        ? "No irrigated ZARC mapping for your soil class (irrigated ZARC uses AD classes 11–16)."
        : crop.crop_id === "common_bean"
          ? "Rainfed ZARC for common bean uses AD soil classes (11–16); there is no mapping from your soil class yet."
          : "No ZARC window for this crop, soil and municipality.",
    );
  }
  if (!pam) {
    out.push(crop.pam_crop ? "No PAM yield series for this crop in this municipality." : "PAM does not survey this crop.");
  }
  out.push("Soil water capacity is assumed (0.11 m³/m³), not measured.");
  return out;
}

/* ---------- main ---------- */

export function buildRecommendation(p: AnalysisParams, municipality: MunicipalityRecord, now = new Date()): Recommendation {
  const ranked: Omit<RankedCrop, "rank">[] = [];
  const excluded: ExcludedCrop[] = [];

  for (const crop of catalog.crops) {
    const zarc = p.regime === "rainfed" ? zarcFor(p.code, crop.crop_id, p.soil) : null;
    const pam = pamFor(p.code, crop.pam_crop);
    const baseSources = [SOURCES.power, ...(zarc ? [SOURCES.zarc] : []), ...(pam ? [SOURCES.pam] : []), SOURCES.fao56];

    if (crop.gate.status !== "passed") {
      excluded.push({
        crop_id: crop.crop_id,
        name: crop.name,
        eligible: false,
        reason_code: crop.gate.status === "failed" ? "gate_failed" : "engine_not_run",
        reason:
          crop.gate.status === "failed"
            ? `Own estimate not reliable: the engine does not reproduce ZARC for this crop (rank correlation ${crop.gate.value}).`
            : "Not ranked yet: the water-balance engine has not been validated for this crop.",
        zarc,
        pam,
        sources: baseSources,
      });
      continue;
    }

    const curve = curveFor(crop, p, zarc);
    const probs = withBands(curve.p);
    ranked.push({
      crop_id: crop.crop_id,
      name: crop.name,
      eligible: true,
      legume: crop.legume,
      best_windows: bestWindows(probs),
      p_success: probs,
      zarc,
      pam,
      flags: { engine_reliable: true, ml_applied: false },
      strengths: strengthsFor(crop, probs, zarc),
      risks: risksFor(probs, zarc, pam, p),
      missing_data: missingFor(crop, zarc, pam, p),
      sources: [...baseSources, curve.source],
      confidence: confidenceFor({ gatePassed: true, p: probs, zarc, nearCentroid: p.nearCentroid }),
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
      near_centroid: p.nearCentroid,
    },
    crops,
    excluded,
    disclaimers: DISCLAIMERS,
  };
}
