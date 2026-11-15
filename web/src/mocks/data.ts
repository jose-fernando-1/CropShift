/**
 * Typed access to the committed mock fixtures (mock-data/*.json).
 * Static imports, so the standalone server bundle always contains them.
 */
import catalogJson from "../../mock-data/catalog.json";
import municipalitiesJson from "../../mock-data/municipalities.json";
import pamJson from "../../mock-data/pam.json";
import prototypeJson from "../../mock-data/prototype.json";
import zarcJson from "../../mock-data/zarc.json";

export type MunicipalityRecord = {
  code: string;
  name: string;
  search: string;
  centroid: { lat: number; lon: number };
  power_cell: { id: string; lat: number; lon: number };
};

export type CatalogCrop = {
  crop_id: string;
  name: string;
  scientific_name: string;
  family: string;
  legume: boolean;
  cycle_days: number;
  pam_crop: string | null;
  gate: { status: "passed" | "failed" | "not_run"; value: number | null; note: string };
};

type ZarcEntry = { v: string; cycle: string; ordinance: string; climate: string };

export const catalog = catalogJson as unknown as {
  method_version: string;
  data_version: string;
  gate_threshold: number;
  crops: CatalogCrop[];
};

export const municipalities = municipalitiesJson as unknown as MunicipalityRecord[];
export const municipalityByCode = new Map(municipalities.map((m) => [m.code, m]));

const zarc = zarcJson as unknown as {
  season: string;
  municipalities: Record<string, Record<string, Record<string, ZarcEntry>>>;
};
export const zarcSeason = zarc.season;

const pam = pamJson as unknown as {
  years: number[];
  state_median: Record<string, number | null>;
  municipalities: Record<string, Record<string, [number, number][]>>;
};
export const pamYears = pam.years;

export const prototype = prototypeJson as unknown as {
  municipality_code: string;
  soil_class: number;
  seasons: number;
  cowpea: number[];
  summaries: Record<string, { zarc_window: number[]; mean_in: number; mean_out: number; rho: number; top5: number[] }>;
};

const ZARC_FROM_DIGIT = { "0": 0, "2": 20, "3": 30, "4": 40 } as const;

export function zarcFor(code: string, cropId: string, soil: number) {
  const entry = zarc.municipalities[code]?.[cropId]?.[String(soil)];
  if (!entry) return null;
  return {
    values: [...entry.v].map((d) => ZARC_FROM_DIGIT[d as keyof typeof ZARC_FROM_DIGIT]),
    cycle_code: entry.cycle,
    soil_code: soil,
    ordinance: entry.ordinance,
    season: zarc.season,
  };
}

export function pamFor(code: string, pamCrop: string | null) {
  if (!pamCrop) return null;
  const series = pam.municipalities[code]?.[pamCrop];
  if (!series || series.length === 0) return null;
  const values = series.map(([, y]) => y);
  return {
    crop_label: pamCrop,
    years: series.map(([year]) => year),
    yield_kg_ha: values,
    municipality_median: median(values),
    state_median: pam.state_median[pamCrop] ?? null,
  };
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
