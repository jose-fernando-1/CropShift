import { handleMock } from "@/mocks/handlers";
import { proxyToBackend } from "./live-proxy";
import { isContractRoute } from "./routes";

/**
 * API_MODE is read per request, so one build or image serves both modes:
 *   API_MODE=mock (default)  -> in-process mock (src/mocks)
 *   API_MODE=live            -> proxy to API_ORIGIN (FastAPI)
 */
export async function handleApi(request: Request, path: string[]) {
  const live = process.env.API_MODE === "live";
  const response = !isContractRoute(request.method, path)
    ? Response.json({ error: { code: "not_found", message: `No route for ${request.method} /api/${path.join("/")}.` } }, { status: 404 })
    : live
      ? await proxyToBackend(request, path)
      : await handleMock(request, path);
  response.headers.set("x-cropshift-mode", live ? "live" : "mock");
  response.headers.set("cache-control", "no-store");
  return response;
}
