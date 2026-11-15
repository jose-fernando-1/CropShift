/**
 * Cropshift API contract, draft v0.1 (plan v2, section 6).
 *
 * Single source of truth for the web client, the mock API and the JSON Schema
 * exported to `/contract` for the FastAPI side. Keep it free of `.refine`,
 * `.transform` and defaults so zod and the exported JSON Schema accept exactly
 * the same instances.
 *
 * Conventions:
 * - municipality_code: 7-digit IBGE code as a string.
 * - dekads (decêndios) are 1-based, 1..36; dekad 1 = Jan 1-10 (assumption).
 * - probabilities are fractions in [0, 1].
 * - a window with end_dekad < start_dekad wraps past the end of the year.
 * - analysis_id is opaque to clients.
 */
import { z } from "zod";

export const CONTRACT_VERSION = "0.1";

export const MunicipalityCode = z
  .string()
  .regex(/^\d{7}$/)
  .describe("7-digit IBGE municipality code");
export const AnalysisId = z
  .string()
  .regex(/^[A-Za-z0-9_.~-]+$/)
  .describe("Opaque id; URL-path-safe characters only (A-Z a-z 0-9 _ . ~ -) because it is a path segment in /explain");
export const Dekad = z.number().int().min(1).max(36).describe("1-based dekad (decêndio), 1 = Jan 1-10");
export const Probability = z.number().min(0).max(1);
export const SoilClass = z.union([z.literal(1), z.literal(2), z.literal(3)]).describe("ZARC soil class: 1 sandy, 2 medium, 3 clayey");
export const Regime = z.enum(["rainfed", "irrigated"]);
export const InputSource = z.enum(["user", "default"]);
export const ZarcValue = z.union([z.literal(0), z.literal(20), z.literal(30), z.literal(40)]);
export const ConfidenceLevel = z.enum(["high", "medium", "low"]);

export const ErrorCode = z.enum([
  "invalid_request",
  "invalid_coordinates",
  "out_of_coverage",
  "not_found",
  "no_data",
  "upstream_unavailable",
  "rate_limited",
  "internal",
]);

export const ApiError = z.object({
  error: z.object({
    code: ErrorCode,
    message: z.string(),
  }),
});

export const Source = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string().nullable(),
  version: z.string().nullable(),
});

export const DatasetVersion = z.object({
  name: z.string(),
  version: z.string(),
  retrieved_at: z.string().describe("ISO date the source was retrieved"),
});

export const PowerCell = z.object({
  id: z.string().describe("POWER grid cell id, e.g. 'r162c230'"),
  lat: z.number().describe("cell centre latitude"),
  lon: z.number().describe("cell centre longitude"),
});

/* ---------- crops catalog ---------- */

export const NumberRange = z
  .object({ min: z.number(), max: z.number() })
  .describe("inclusive range as the source lists it; min == max for a single value");

/** Raw crop sheet (FAO-56 + FAO EcoCrop), values as published. Static per crop, not per location. */
export const CropRequirements = z.object({
  fao56: z.object({
    stage_days: z
      .object({
        initial: z.number().int().nonnegative(),
        development: z.number().int().nonnegative(),
        mid_season: z.number().int().nonnegative(),
        late_season: z.number().int().nonnegative(),
        total: z.number().int().positive().describe("as listed; may differ from the stage sum"),
      })
      .describe("FAO-56 Table 11 stage lengths, days"),
    kc: z
      .object({
        initial: z.number().nullable().describe("null: not listed (FAO-56 derives Kc ini from wetting frequency)"),
        mid: NumberRange,
        end: NumberRange,
      })
      .describe("FAO-56 single crop coefficients"),
    max_height_m: NumberRange,
    max_root_depth_m: NumberRange,
    depletion_fraction: z.number().min(0).max(1).describe("FAO-56 p: share of available water used before stress"),
    salinity_threshold_ece_ds_m: NumberRange.nullable().describe("soil salinity (ECe, dS/m) at which yield starts to drop"),
  }),
  ecocrop: z.object({
    species: z.string(),
    temperature_optimal_c: NumberRange,
    temperature_absolute_c: NumberRange,
    rainfall_optimal_mm: NumberRange.describe("annual rainfall, mm"),
    rainfall_absolute_mm: NumberRange.describe("annual rainfall, mm"),
    ph_optimal: NumberRange,
    cycle_days: NumberRange,
    tolerances: z.array(z.string()).describe("EcoCrop tolerance tags, e.g. 'drought'"),
  }),
});

export const QualityGate = z.object({
  passed: z.boolean(),
  status: z.enum(["passed", "failed", "not_run"]),
  metric: z.literal("spearman"),
  value: z.number().nullable().describe("rank correlation with ZARC on held-out municipalities"),
  threshold: z.number(),
  note: z.string(),
});

export const Crop = z.object({
  crop_id: z.string(),
  name: z.string(),
  scientific_name: z.string(),
  family: z.string(),
  legume: z.boolean(),
  cycle_days: z.number().int().positive(),
  gate: QualityGate,
  has_zarc: z.boolean(),
  has_pam: z.boolean(),
  requirements: CropRequirements.nullable().describe("null when the crop sheet has no row for this crop"),
});

export const CropsResponse = z.object({
  contract_version: z.string(),
  mock: z.boolean(),
  crops: z.array(Crop),
});

/* ---------- locations ---------- */

export const Coordinates = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});

export const ResolveRequest = Coordinates;

export const ResolvedMunicipality = z.object({
  municipality_code: MunicipalityCode,
  municipality_name: z.string(),
  state: z.literal("PE"),
  power_cell: PowerCell,
  near_centroid: z.boolean().describe("point falls in the same POWER cell as the municipality centroid"),
});

export const ResolveResponse = z.union([
  z.object({
    coverage: z.literal("covered"),
    mock: z.boolean(),
    municipality: ResolvedMunicipality,
  }),
  z.object({
    coverage: z.literal("out_of_state"),
    mock: z.boolean(),
    municipality: z.null(),
  }),
]);

/* ---------- recommendations ---------- */

const RecommendationOptions = {
  soil_class: SoilClass.optional(),
  regime: Regime.optional(),
};

export const RecommendationRequest = z.union([
  z.object({ lat: Coordinates.shape.lat, lon: Coordinates.shape.lon, ...RecommendationOptions }).strict(),
  z.object({ municipality_code: MunicipalityCode, ...RecommendationOptions }).strict(),
]);

export const Location = z.object({
  municipality_code: MunicipalityCode,
  municipality_name: z.string(),
  power_cell: PowerCell,
  soil_class: SoilClass,
  soil_source: InputSource,
  regime: Regime,
  regime_source: InputSource,
  input_mode: z.enum(["point", "municipality"]),
  near_centroid: z.boolean(),
});

export const DekadProbability = z.object({
  p: Probability,
  lo: Probability,
  hi: Probability,
});

export const PlantingWindow = z.object({
  start_dekad: Dekad,
  end_dekad: Dekad,
  mean_p: Probability,
});

export const Zarc = z.object({
  values: z.array(ZarcValue).length(36).describe("ZARC value per dekad; 0 = not recommended. Meaning of 20/30/40 unconfirmed"),
  cycle_code: z.string(),
  soil_code: z.number().int().describe("ZARC soil code: 1-3 texture classes or 11-16 (AD1-AD6)"),
  ordinance: z.string(),
  season: z.string().describe("ZARC season, e.g. '2025/2026'"),
});

export const Pam = z.object({
  crop_label: z.string().describe("PAM product used, e.g. 'feijao' (all beans pooled)"),
  years: z.array(z.number().int()),
  yield_kg_ha: z.array(z.number()),
  municipality_median: z.number().nullable(),
  state_median: z.number().nullable(),
});

export const Confidence = z.object({
  level: ConfidenceLevel,
  reasons: z.array(z.string()).min(1),
});

export const RankedCrop = z.object({
  crop_id: z.string(),
  name: z.string(),
  rank: z.number().int().min(1),
  eligible: z.literal(true),
  legume: z.boolean().describe("Fabaceae: can fix nitrogen"),
  best_windows: z.array(PlantingWindow),
  p_success: z.array(DekadProbability).length(36),
  zarc: Zarc.nullable(),
  pam: Pam.nullable(),
  flags: z.object({
    engine_reliable: z.boolean(),
    ml_applied: z.boolean(),
  }),
  strengths: z.array(z.string()),
  risks: z.array(z.string()),
  missing_data: z.array(z.string()),
  sources: z.array(Source),
  confidence: Confidence,
});

export const ExcludedReason = z.enum(["gate_failed", "engine_not_run", "no_data_for_regime"]);

export const ExcludedCrop = z.object({
  crop_id: z.string(),
  name: z.string(),
  eligible: z.literal(false),
  reason_code: ExcludedReason,
  reason: z.string(),
  zarc: Zarc.nullable(),
  pam: Pam.nullable(),
  sources: z.array(Source),
});

export const Disclaimer = z.object({
  id: z.string(),
  text: z.string(),
});

export const Recommendation = z.object({
  analysis_id: AnalysisId,
  contract_version: z.string(),
  method_version: z.string(),
  dataset_versions: z.array(DatasetVersion),
  mock: z.boolean(),
  generated_at: z.string(),
  location: Location,
  crops: z.array(RankedCrop),
  excluded: z.array(ExcludedCrop),
  disclaimers: z.array(Disclaimer),
});

/* ---------- explanation ---------- */

export const ExplanationSection = z.object({
  id: z.string(),
  title: z.string(),
  paragraphs: z.array(z.string()),
});

export const Explanation = z.object({
  analysis_id: AnalysisId,
  source: z.enum(["template", "ai"]),
  mock: z.boolean(),
  generated_at: z.string(),
  sections: z.array(ExplanationSection),
  field_checks: z.array(z.string()).describe("what the farmer should verify in the field"),
});

/* ---------- health ---------- */

export const Health = z.object({
  status: z.enum(["ok", "degraded"]),
  contract_version: z.string(),
  method_version: z.string(),
  data_version: z.string(),
  mock: z.boolean(),
});

/** Every schema exported to /contract, keyed by file name. */
export const CONTRACT_SCHEMAS = {
  "api-error": ApiError,
  crops: CropsResponse,
  "resolve-request": ResolveRequest,
  "resolve-response": ResolveResponse,
  "recommendation-request": RecommendationRequest,
  recommendation: Recommendation,
  explanation: Explanation,
  health: Health,
} as const;
