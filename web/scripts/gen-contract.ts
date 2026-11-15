/**
 * Exports the zod contract to /contract (repo root) for the FastAPI side:
 *   contract/<name>.schema.json   JSON Schema (draft 2020-12)
 *   contract/examples/*.json      golden responses from the mock
 *
 * Usage: npm run gen:contract            (write)
 *        npm run gen:contract -- --check  (fail if files are stale)
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { CONTRACT_SCHEMAS, CONTRACT_VERSION } from "../src/contract/schemas";
import type { SoilClass } from "../src/contract/types";
import type { Locale } from "../src/i18n";
import { templateExplanation } from "../src/lib/explain/template";
import { buildRecommendation, type AnalysisParams } from "../src/mocks/build-recommendation";
import { municipalityByCode } from "../src/mocks/data";

const contractDir = path.resolve(import.meta.dirname, "../../contract");
const FIXED_NOW = new Date("2026-11-14T12:00:00Z");
const SBU = "2613008";
const PETROLINA = "2611101";
const RECIFE = "2611606";

function rec(code: string, soil: SoilClass, regime: "rainfed" | "irrigated", user = true, locale: Locale = "en") {
  const params: AnalysisParams = {
    code,
    soil,
    soilSource: user ? "user" : "default",
    regime,
    regimeSource: user ? "user" : "default",
    inputMode: "municipality",
    nearCentroid: true,
  };
  return buildRecommendation(params, municipalityByCode.get(code)!, FIXED_NOW, locale);
}

function files(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, schema] of Object.entries(CONTRACT_SCHEMAS)) {
    out[`${name}.schema.json`] = {
      $id: `https://fieldshift.local/contract/${CONTRACT_VERSION}/${name}.schema.json`,
      title: `Field Shift ${name} (contract v${CONTRACT_VERSION})`,
      ...z.toJSONSchema(schema),
    };
  }

  for (const soil of [1, 2, 3] as const) {
    for (const regime of ["rainfed", "irrigated"] as const) {
      out[`examples/recommendation.sao-bento-do-una.soil${soil}.${regime}.json`] = rec(SBU, soil, regime);
    }
  }
  out["examples/recommendation.sao-bento-do-una.defaults.json"] = rec(SBU, 2, "rainfed", false);
  out["examples/recommendation.petrolina.soil2.rainfed.json"] = rec(PETROLINA, 2, "rainfed");
  out["examples/recommendation.recife.soil2.rainfed.json"] = rec(RECIFE, 2, "rainfed");
  out["examples/explanation.sao-bento-do-una.soil2.rainfed.json"] = templateExplanation(rec(SBU, 2, "rainfed"), FIXED_NOW);
  // Accept-Language: pt-BR (same numbers and ids; only human-readable text changes)
  out["examples/recommendation.sao-bento-do-una.soil2.rainfed.pt-BR.json"] = rec(SBU, 2, "rainfed", true, "pt-BR");
  out["examples/explanation.sao-bento-do-una.soil2.rainfed.pt-BR.json"] = templateExplanation(
    rec(SBU, 2, "rainfed", true, "pt-BR"),
    FIXED_NOW,
    "pt-BR",
  );
  out["examples/recommendation-request.point.json"] = { lat: -8.6, lon: -36.4, soil_class: 2, regime: "rainfed" };
  out["examples/recommendation-request.municipality.json"] = { municipality_code: SBU };
  out["examples/resolve-response.covered.json"] = {
    coverage: "covered",
    mock: true,
    municipality: {
      municipality_code: SBU,
      municipality_name: "São Bento do Una",
      state: "PE",
      power_cell: municipalityByCode.get(SBU)!.power_cell,
      near_centroid: true,
    },
  };
  out["examples/resolve-response.out-of-state.json"] = { coverage: "out_of_state", mock: true, municipality: null };
  out["examples/api-error.out-of-coverage.json"] = {
    error: { code: "out_of_coverage", message: "This point is outside Pernambuco. Field Shift covers Pernambuco only." },
  };
  return out;
}

async function main() {
  const check = process.argv.includes("--check");
  const stale: string[] = [];
  await mkdir(path.join(contractDir, "examples"), { recursive: true });
  for (const [rel, content] of Object.entries(files())) {
    const file = path.join(contractDir, rel);
    const text = JSON.stringify(content, null, 2) + "\n";
    if (check) {
      const current = await readFile(file, "utf8").catch(() => null);
      if (current !== text) stale.push(rel);
    } else {
      await writeFile(file, text);
    }
  }
  if (check && stale.length > 0) {
    console.error(`contract files are stale, run 'npm run gen:contract':\n  ${stale.join("\n  ")}`);
    process.exit(1);
  }
  console.log(check ? "contract files are up to date" : `wrote contract v${CONTRACT_VERSION} to ${contractDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
