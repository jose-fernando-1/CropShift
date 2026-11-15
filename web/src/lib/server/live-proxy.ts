/**
 * Live mode: forwards `/api/<path>` to the FastAPI backend (API_ORIGIN) and
 * normalizes failures into the contract's error envelope, so the UI shows
 * "API unavailable" instead of a schema error when the backend is down.
 */
import { ApiError } from "@/contract/schemas";

const FORWARDED_REQUEST_HEADERS = ["content-type", "accept", "accept-language", "x-request-id"];

function error(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

/**
 * `/api/health` maps to the backend's `/health`; everything else keeps its path.
 * Callers pass only allowlisted routes (see routes.ts); segments are re-encoded anyway.
 */
export function upstreamPath(path: string[]) {
  const joined = path.map(encodeURIComponent).join("/");
  return joined === "health" ? "/health" : `/api/${joined}`;
}

export async function proxyToBackend(request: Request, path: string[]): Promise<Response> {
  const origin = process.env.API_ORIGIN;
  if (!origin) return error(503, "upstream_unavailable", "API_ORIGIN is not configured.");
  const timeoutMs = Number(process.env.API_TIMEOUT_MS ?? 15000);

  const incoming = new URL(request.url);
  const target = new URL(upstreamPath(path) + incoming.search, origin);

  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const clientIp = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip");
  if (clientIp) headers.set("x-forwarded-for", clientIp);

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.text(),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch {
    return error(503, "upstream_unavailable", "The Field Shift API is unreachable. Try again in a minute.");
  }

  const text = await upstream.text();
  if (upstream.ok) {
    const headers = new Headers({ "content-type": upstream.headers.get("content-type") ?? "application/json" });
    const language = upstream.headers.get("content-language");
    if (language) headers.set("content-language", language);
    return new Response(text, { status: upstream.status, headers });
  }

  // Pass contract errors through; wrap anything else (FastAPI's default 422 {detail}, HTML 502 pages, ...).
  try {
    const parsed = ApiError.safeParse(JSON.parse(text));
    if (parsed.success) return Response.json(parsed.data, { status: upstream.status });
  } catch {
    /* not JSON */
  }
  if (upstream.status === 422 || upstream.status === 400) {
    return error(upstream.status, "invalid_request", "The API rejected the request.");
  }
  if (upstream.status === 404) return error(404, "not_found", "The API has no such resource.");
  if (upstream.status === 429) return error(429, "rate_limited", "Too many requests. Wait a moment and try again.");
  if (upstream.status >= 500) return error(503, "upstream_unavailable", "The Field Shift API failed. Try again in a minute.");
  return error(upstream.status, "internal", `Unexpected API response (HTTP ${upstream.status}).`);
}
