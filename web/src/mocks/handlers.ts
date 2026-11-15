/**
 * Mock implementation of the Field Shift API (plan v2, section 6).
 * Same paths, schemas and error envelope as the FastAPI backend.
 */
import type { z } from "zod";
import * as S from "@/contract/schemas";
import type { ErrorCode, SoilClass } from "@/contract/types";
import { templateExplanation } from "@/lib/explain/template";
import { buildRecommendation, decodeAnalysisId, type AnalysisParams } from "./build-recommendation";
import { catalog, municipalityByCode } from "./data";
import { findMunicipality, isNearCentroid } from "./resolve";
import { scenarioFrom } from "./scenarios";

const DEFAULT_SOIL: SoilClass = 2;

export function errorResponse(status: number, code: ErrorCode, message: string) {
  return Response.json({ error: { code, message } } satisfies z.infer<typeof S.ApiError>, { status });
}

/** Validate our own output too: a mock that drifts from the contract fails loudly. */
function ok<T extends z.ZodType>(schema: T, body: z.infer<T>, status = 200) {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    console.error("mock response violates contract", parsed.error.issues.slice(0, 5));
    return errorResponse(500, "internal", "Mock response does not match the contract.");
  }
  return Response.json(parsed.data, { status });
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

function latency() {
  const fixed = process.env.MOCK_LATENCY_MS;
  const ms = fixed !== undefined ? Number(fixed) : 300 + Math.random() * 600;
  return ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve();
}

function crops() {
  return ok(S.CropsResponse, {
    contract_version: S.CONTRACT_VERSION,
    mock: true,
    crops: catalog.crops.map((c) => ({
      crop_id: c.crop_id,
      name: c.name,
      scientific_name: c.scientific_name,
      family: c.family,
      legume: c.legume,
      cycle_days: c.cycle_days,
      gate: {
        passed: c.gate.status === "passed",
        status: c.gate.status,
        metric: "spearman" as const,
        value: c.gate.value,
        threshold: catalog.gate_threshold,
        note: c.gate.note,
      },
      has_zarc: c.crop_id !== "common_bean",
      has_pam: c.pam_crop !== null,
    })),
  });
}

async function resolve(request: Request) {
  const body = S.ResolveRequest.safeParse(await readJson(request));
  if (!body.success) return errorResponse(422, "invalid_coordinates", "Latitude must be in [-90, 90] and longitude in [-180, 180].");
  const m = findMunicipality(body.data.lat, body.data.lon);
  if (!m) return ok(S.ResolveResponse, { coverage: "out_of_state", mock: true, municipality: null });
  return ok(S.ResolveResponse, {
    coverage: "covered",
    mock: true,
    municipality: {
      municipality_code: m.code,
      municipality_name: m.name,
      state: "PE",
      power_cell: m.power_cell,
      near_centroid: isNearCentroid(m, body.data.lat, body.data.lon),
    },
  });
}

async function recommend(request: Request) {
  const scenario = scenarioFrom(request);
  if (scenario === "power_down") {
    return errorResponse(503, "upstream_unavailable", "NASA POWER did not answer in time. Try again in a minute.");
  }
  const body = S.RecommendationRequest.safeParse(await readJson(request));
  if (!body.success) return errorResponse(422, "invalid_request", "Send lat/lon or municipality_code, plus optional soil_class (1-3) and regime.");

  const input = body.data;
  let params: AnalysisParams;
  const options = {
    soil: input.soil_class ?? DEFAULT_SOIL,
    soilSource: input.soil_class ? ("user" as const) : ("default" as const),
    regime: input.regime ?? ("rainfed" as const),
    regimeSource: input.regime ? ("user" as const) : ("default" as const),
  };
  if ("municipality_code" in input) {
    const m = municipalityByCode.get(input.municipality_code);
    if (!m) return errorResponse(422, "out_of_coverage", "This municipality is not covered. Field Shift covers Pernambuco only.");
    params = { code: m.code, ...options, inputMode: "municipality", nearCentroid: true };
  } else {
    const m = findMunicipality(input.lat, input.lon);
    if (!m) return errorResponse(422, "out_of_coverage", "This point is outside Pernambuco. Field Shift covers Pernambuco only.");
    params = { code: m.code, ...options, inputMode: "point", nearCentroid: isNearCentroid(m, input.lat, input.lon) };
  }

  if (scenario === "no_data") {
    return errorResponse(404, "no_data", "There is no precomputed climate data for this place yet.");
  }
  const municipality = municipalityByCode.get(params.code)!;
  return ok(S.Recommendation, buildRecommendation(params, municipality));
}

function explain(request: Request, id: string) {
  if (scenarioFrom(request) === "explain_down") {
    return errorResponse(500, "internal", "The explanation service failed.");
  }
  const params = decodeAnalysisId(id);
  const municipality = params && municipalityByCode.get(params.code);
  if (!params || !municipality) return errorResponse(404, "not_found", "Unknown analysis id.");
  return ok(S.Explanation, templateExplanation(buildRecommendation(params, municipality)));
}

function health() {
  return ok(S.Health, {
    status: "ok",
    contract_version: S.CONTRACT_VERSION,
    method_version: catalog.method_version,
    data_version: catalog.data_version,
    mock: true,
  });
}

/** Dispatch `/api/<path>` to the mock. `path` excludes the `/api/` prefix. */
export async function handleMock(request: Request, path: string[]): Promise<Response> {
  await latency();
  const method = request.method;
  const route = path.join("/");

  if (route === "health" && method === "GET") return health();
  if (route === "v1/crops" && method === "GET") return crops();
  if (route === "v1/locations/resolve" && method === "POST") return resolve(request);
  if (route === "v1/recommendations" && method === "POST") return recommend(request);
  const explainMatch = /^v1\/recommendations\/([^/]+)\/explain$/.exec(route);
  if (explainMatch && method === "POST") return explain(request, decodeURIComponent(explainMatch[1]));

  return errorResponse(404, "not_found", `No route for ${method} /api/${route}.`);
}
