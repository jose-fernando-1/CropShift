/**
 * The only API paths the web server answers (contract v0.1). Anything else is
 * rejected before it reaches the mock or the backend, so the public origin
 * never exposes other FastAPI routes (/docs, /openapi.json, admin, ...).
 */
/** Same character set as the contract's AnalysisId. */
const SAFE_SEGMENT = /^[A-Za-z0-9_.~-]+$/;

const ROUTES: { method: string; pattern: RegExp }[] = [
  { method: "GET", pattern: /^health$/ },
  { method: "GET", pattern: /^v1\/crops$/ },
  { method: "POST", pattern: /^v1\/locations\/resolve$/ },
  { method: "POST", pattern: /^v1\/recommendations$/ },
  { method: "POST", pattern: /^v1\/recommendations\/[^/]+\/explain$/ },
];

/** True when every segment is a plain token (no "/", "?", "#", "\\", "." or "..") and the route is in the contract. */
export function isContractRoute(method: string, path: string[]) {
  if (path.length === 0 || path.some((s) => !SAFE_SEGMENT.test(s) || s === "." || s === "..")) return false;
  const joined = path.join("/");
  return ROUTES.some((r) => r.method === method && r.pattern.test(joined));
}
