/**
 * Compacts the real ZARC (MAPA, CC BY) and IBGE PAM tables for Pernambuco into
 * the mock fixtures used by the web mock API.
 *
 * Usage (each input is optional; only the outputs for the inputs given are written):
 *   npm run gen:fixtures -- --zarc <zarc_tabua_risco_safra2025_2026_PE.csv> --pam <ibge_pam_PE_2005_2024_culturas_chave.csv>
 *                           --ficha <ficha_exigencias_culturas_FAO56_EcoCrop.csv>
 *
 * Inputs are read as plain data. Outputs (committed):
 *   mock-data/zarc.json  { season, crops, municipalities: { code: { crop_id: { soil: entry } } } }
 *                        entry.v is a 36-char string, one digit per dekad: 0, 2 (=20), 3 (=30), 4 (=40)
 *   mock-data/pam.json   { years, crops, state_median, municipalities: { code: { pam_crop: [[year, kg_ha]] } } }
 *   mock-data/requirements.json  { crop_id: CropRequirements }  raw FAO-56 + EcoCrop crop sheet, shaped like the contract
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

const root = path.resolve(import.meta.dirname, "..");

/** ZARC "Nome_cultura" (rainfed rows) -> crop_id. Common bean (Feijão 2ª Safra) only has AD soil classes 11-16 and is left out on purpose. */
const ZARC_CROPS: Record<string, string> = {
  "Feijão Caupi": "cowpea",
  Amendoim: "peanut",
  "Sorgo Granífero": "sorghum",
  "Milho 1ª Safra": "maize",
  Girassol: "sunflower",
  Mamona: "castor",
};
const PREFERRED_CYCLE = "21";
const TEXTURE_SOILS = new Set(["1", "2", "3"]);
const PAM_CROPS = new Set(["feijao", "milho", "sorgo", "amendoim", "mamona"]);
const ZARC_DIGIT: Record<string, string> = { "0": "0", "20": "2", "30": "3", "40": "4" };

type ZarcEntry = { v: string; cycle: string; ordinance: string; climate: string };

function parseDelimited(text: string, delimiter: string): Record<string, string>[] {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.length > 0);
  const header = lines[0].split(delimiter);
  return lines.slice(1).map((line, i) => {
    const cells = line.split(delimiter);
    if (cells.length !== header.length) {
      throw new Error(`line ${i + 2}: expected ${header.length} columns, got ${cells.length}`);
    }
    return Object.fromEntries(header.map((h, j) => [h, cells[j]]));
  });
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Prefer cycle 21, then the lowest cycle; prefer the general climate over a regional variant. */
function better(candidate: ZarcEntry, current: ZarcEntry | undefined): boolean {
  if (!current) return true;
  const rank = (e: ZarcEntry) => [e.cycle === PREFERRED_CYCLE ? 0 : 1, Number(e.cycle), e.climate === "Não se aplica" ? 0 : 1];
  const [a, b] = [rank(candidate), rank(current)];
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
}

async function buildZarc(file: string) {
  const rows = parseDelimited(await readFile(file, "utf8"), ";");
  const seasons = new Set<string>();
  const out: Record<string, Record<string, Record<string, ZarcEntry>>> = {};
  for (const r of rows) {
    const cropId = ZARC_CROPS[r.Nome_cultura];
    if (!cropId || r.Nome_Outros_Manejos !== "Sequeiro" || !TEXTURE_SOILS.has(r.Cod_Solo)) continue;
    seasons.add(`${r.SafraIni}/${r.SafraFin}`);
    const digits = Array.from({ length: 36 }, (_, i) => {
      const d = ZARC_DIGIT[r[`dec${i + 1}`]];
      if (d === undefined) throw new Error(`unexpected ZARC value '${r[`dec${i + 1}`]}' in ${r.geocodigo}`);
      return d;
    }).join("");
    const entry: ZarcEntry = { v: digits, cycle: r.Cod_Ciclo, ordinance: r.Portaria, climate: r.Nome_Clima };
    const byCrop = (out[r.geocodigo] ??= {});
    const bySoil = (byCrop[cropId] ??= {});
    if (better(entry, bySoil[r.Cod_Solo])) bySoil[r.Cod_Solo] = entry;
  }
  if (seasons.size !== 1) throw new Error(`expected one ZARC season, got ${[...seasons].join(", ")}`);
  return { season: [...seasons][0], crops: Object.values(ZARC_CROPS), municipalities: out };
}

async function buildPam(file: string) {
  const rows = parseDelimited(await readFile(file, "utf8"), ",");
  const out: Record<string, Record<string, [number, number][]>> = {};
  const all: Record<string, number[]> = {};
  const years = new Set<number>();
  for (const r of rows) {
    if (!PAM_CROPS.has(r.cultura)) continue;
    const yieldKgHa = Number(r.rendimento_kg_ha);
    const year = Number(r.ano);
    if (!Number.isFinite(yieldKgHa) || yieldKgHa <= 0 || !Number.isInteger(year)) continue;
    years.add(year);
    ((out[r.cod_mun] ??= {})[r.cultura] ??= []).push([year, yieldKgHa]);
    (all[r.cultura] ??= []).push(yieldKgHa);
  }
  for (const byCrop of Object.values(out)) for (const series of Object.values(byCrop)) series.sort((a, b) => a[0] - b[0]);
  const state_median = Object.fromEntries(Object.entries(all).map(([c, v]) => [c, median(v)]));
  return {
    years: [Math.min(...years), Math.max(...years)],
    crops: [...PAM_CROPS],
    state_median,
    municipalities: out,
  };
}

/** Crop sheet "cultura" -> crop_id. Rows for crops outside the catalog (cotton, millet, cassava, sweet potato) are skipped. */
const FICHA_CROPS: Record<string, string> = {
  "Feijão-caupi": "cowpea",
  "Feijão comum": "common_bean",
  Amendoim: "peanut",
  "Milho (grão)": "maize",
  "Sorgo (grão)": "sorghum",
  Mamona: "castor",
  Girassol: "sunflower",
};

type NumRange = { min: number; max: number };

/** "0.6-1.0" -> {min 0.6, max 1}; "1.05" -> {min 1.05, max 1.05}; "" or "-" -> null. Order-insensitive ("0.60-0.35"). */
function range(raw: string, column: string): NumRange | null {
  const v = raw.trim();
  if (v === "" || v === "-") return null;
  const cells = v.split("-").map((x) => x.trim());
  const parts = cells.map(Number);
  if (cells.length > 2 || cells.some((x) => x === "") || parts.some((n) => !Number.isFinite(n))) {
    throw new Error(`${column}: cannot parse "${raw}"`);
  }
  return { min: Math.min(...parts), max: Math.max(...parts) };
}

function requiredRange(raw: string, column: string): NumRange {
  const r = range(raw, column);
  if (!r) throw new Error(`${column}: missing value`);
  return r;
}

function single(raw: string, column: string): number | null {
  const r = range(raw, column);
  if (r && r.min !== r.max) throw new Error(`${column}: expected one value, got "${raw}"`);
  return r ? r.min : null;
}

async function buildRequirements(file: string) {
  const rows = parseDelimited(await readFile(file, "utf8"), ",");
  const out: Record<string, unknown> = {};
  for (const row of rows) {
    const cropId = FICHA_CROPS[row.cultura];
    if (!cropId) continue;
    const stages = row.fao56_fases_ini_dev_mid_late_total_dias.split("/").map(Number);
    if (stages.length !== 5 || stages.some((n) => !Number.isInteger(n))) throw new Error(`${row.cultura}: bad stage lengths`);
    const [initial, development, mid_season, late_season, total] = stages;
    // Kept raw: the sheet's total does not always equal the stage sum (cowpea 100 vs 110, sorghum 125 vs 130).
    const depletion = single(row["fracao_depleção_p"], "fracao_depleção_p");
    if (depletion === null) throw new Error(`${row.cultura}: missing depletion fraction`);
    out[cropId] = {
      fao56: {
        stage_days: { initial, development, mid_season, late_season, total },
        kc: {
          initial: single(row.kc_ini, "kc_ini"),
          mid: requiredRange(row.kc_mid, "kc_mid"),
          end: requiredRange(row.kc_end, "kc_end"),
        },
        max_height_m: requiredRange(row.altura_max_m, "altura_max_m"),
        max_root_depth_m: requiredRange(row.raiz_max_m, "raiz_max_m"),
        depletion_fraction: depletion,
        salinity_threshold_ece_ds_m: range(row.salinidade_ECe_limiar_dSm, "salinidade_ECe_limiar_dSm"),
      },
      ecocrop: {
        species: row.eco_especie,
        temperature_optimal_c: requiredRange(row.eco_T_otima, "eco_T_otima"),
        temperature_absolute_c: requiredRange(row.eco_T_abs, "eco_T_abs"),
        rainfall_optimal_mm: requiredRange(row.eco_chuva_otima_mm, "eco_chuva_otima_mm"),
        rainfall_absolute_mm: requiredRange(row.eco_chuva_abs_mm, "eco_chuva_abs_mm"),
        ph_optimal: requiredRange(row.eco_pH_otimo, "eco_pH_otimo"),
        cycle_days: requiredRange(row.eco_ciclo_dias, "eco_ciclo_dias"),
        tolerances: row.eco_tolerancia
          .split(/[;|]/)
          .map((t) => t.trim())
          .filter(Boolean),
      },
    };
  }
  const missing = Object.values(FICHA_CROPS).filter((id) => !(id in out));
  if (missing.length > 0) throw new Error(`crop sheet has no row for: ${missing.join(", ")}`);
  return out;
}

async function main() {
  const { values } = parseArgs({ options: { zarc: { type: "string" }, pam: { type: "string" }, ficha: { type: "string" } } });
  if (!values.zarc && !values.pam && !values.ficha) {
    throw new Error("usage: build-mock-fixtures [--zarc <csv>] [--pam <csv>] [--ficha <csv>]");
  }
  if (values.zarc) {
    const zarc = await buildZarc(values.zarc);
    await writeFile(path.join(root, "mock-data/zarc.json"), JSON.stringify(zarc) + "\n");
    console.log(`zarc: season ${zarc.season}, ${Object.keys(zarc.municipalities).length} municipalities`);
  }
  if (values.pam) {
    const pam = await buildPam(values.pam);
    await writeFile(path.join(root, "mock-data/pam.json"), JSON.stringify(pam) + "\n");
    console.log(`pam: ${pam.years.join("-")}, ${Object.keys(pam.municipalities).length} municipalities`);
  }
  if (values.ficha) {
    const requirements = await buildRequirements(values.ficha);
    await writeFile(path.join(root, "mock-data/requirements.json"), JSON.stringify(requirements, null, 2) + "\n");
    console.log(`requirements: ${Object.keys(requirements).length} crops`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
