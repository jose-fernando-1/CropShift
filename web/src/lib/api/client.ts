/**
 * The only way the UI talks to the API. Every response is parsed with the
 * contract schema; failures become a typed ApiClientError. Calls are recorded
 * in the request log for the data-flow inspector.
 */
import type { z } from "zod";
import * as S from "@/contract/schemas";
import type { ErrorCode, RecommendationRequest, ResolveRequest } from "@/contract/types";
import { requestLog } from "./request-log";

export type ClientErrorCode = ErrorCode | "network" | "schema_mismatch";

export class ApiClientError extends Error {
  constructor(
    public code: ClientErrorCode,
    message: string,
    public status: number | null,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

let scenario: string | null = null;
/** Mock-mode failure scenario sent as a header on every call (inspector only). */
export function setMockScenario(value: string | null) {
  scenario = value && value !== "none" ? value : null;
}
export function getMockScenario() {
  return scenario ?? "none";
}

async function call<T extends z.ZodType>(
  schemaName: string,
  schema: T,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<z.infer<T>> {
  const logId = requestLog.start({ method, path, requestBody: body, schema: schemaName });
  const started = performance.now();
  const headers: Record<string, string> = { accept: "application/json" };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (scenario) headers["x-mock-scenario"] = scenario;

  let res: Response;
  try {
    res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    requestLog.finish(logId, { durationMs: performance.now() - started, schemaOk: null });
    throw new ApiClientError("network", "Could not reach the server. Check your connection.", null);
  }

  const mode = res.headers.get("x-fieldshift-mode");
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    json = undefined;
  }
  const finish = (patch: Parameters<typeof requestLog.finish>[1]) =>
    requestLog.finish(logId, { status: res.status, durationMs: performance.now() - started, mode, responseBody: json, ...patch });

  if (!res.ok) {
    const err = S.ApiError.safeParse(json);
    finish({ schema: "api-error", schemaOk: err.success, schemaIssues: err.success ? [] : issues(err.error) });
    if (err.success) throw new ApiClientError(err.data.error.code, err.data.error.message, res.status);
    throw new ApiClientError(res.status >= 500 ? "upstream_unavailable" : "internal", `Unexpected API error (HTTP ${res.status}).`, res.status);
  }

  const parsed = schema.safeParse(json);
  finish({ schemaOk: parsed.success, schemaIssues: parsed.success ? [] : issues(parsed.error) });
  if (!parsed.success) {
    throw new ApiClientError("schema_mismatch", `The API answer does not match contract v${S.CONTRACT_VERSION}.`, res.status);
  }
  return parsed.data;
}

function issues(error: z.ZodError) {
  return error.issues.slice(0, 8).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
}

export const api = {
  health: () => call("health", S.Health, "GET", "/api/health"),
  crops: () => call("crops", S.CropsResponse, "GET", "/api/v1/crops"),
  resolve: (body: ResolveRequest) => call("resolve-response", S.ResolveResponse, "POST", "/api/v1/locations/resolve", body),
  recommend: async (body: RecommendationRequest) => {
    const rec = await call("recommendation", S.Recommendation, "POST", "/api/v1/recommendations", body);
    // Contract invariant the JSON Schema cannot express: a crop is ranked or excluded, never both.
    const ranked = new Set(rec.crops.map((c) => c.crop_id));
    const both = rec.excluded.filter((e) => ranked.has(e.crop_id)).map((e) => e.crop_id);
    if (both.length > 0) {
      throw new ApiClientError("schema_mismatch", `Crops both ranked and excluded: ${both.join(", ")}.`, 200);
    }
    return rec;
  },
  explain: (analysisId: string) =>
    call("explanation", S.Explanation, "POST", `/api/v1/recommendations/${encodeURIComponent(analysisId)}/explain`),
};
