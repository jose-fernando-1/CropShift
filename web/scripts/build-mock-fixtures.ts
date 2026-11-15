/**
 * Compacts the real ZARC (MAPA, CC BY) and IBGE PAM tables for Pernambuco into
 * the mock fixtures used by the web mock API.
 *
 * Usage:
 *   npm run gen:fixtures -- --zarc <zarc_tabua_risco_safra2025_2026_PE.csv> --pam <ibge_pam_PE_2005_2024_culturas_chave.csv>
 *
 * Inputs are read as plain data. Outputs (committed):
 *   mock-data/zarc.json  { season, crops, municipalities: { code: { crop_id: { soil: entry } } } }
 *                        entry.v is a 36-char string, one digit per dekad: 0, 2 (=20), 3 (=30), 4 (=40)
 *   mock-data/pam.json   { years, crops, state_median, municipalities: { code: { pam_crop: [[year, kg_ha]] } } }
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

async function main() {
  const { values } = parseArgs({ options: { zarc: { type: "string" }, pam: { type: "string" } } });
  if (!values.zarc || !values.pam) {
    throw new Error("usage: build-mock-fixtures --zarc <csv> --pam <csv>");
  }
  const zarc = await buildZarc(values.zarc);
  const pam = await buildPam(values.pam);
  await writeFile(path.join(root, "mock-data/zarc.json"), JSON.stringify(zarc) + "\n");
  await writeFile(path.join(root, "mock-data/pam.json"), JSON.stringify(pam) + "\n");
  console.log(
    `zarc: season ${zarc.season}, ${Object.keys(zarc.municipalities).length} municipalities; ` +
      `pam: ${pam.years.join("-")}, ${Object.keys(pam.municipalities).length} municipalities`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
