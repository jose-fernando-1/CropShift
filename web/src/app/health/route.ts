/**
 * `/health` mirrors the FastAPI liveness path, so a web instance can stand in
 * for the backend (API_ORIGIN) in the live-mode test. Same handler as /api/health.
 */
import { handleApi } from "@/lib/server/handle-api";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return handleApi(request, ["health"]);
}
