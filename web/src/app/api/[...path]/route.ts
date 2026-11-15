/**
 * Single entry point for `/api/*`: mock or live proxy, chosen per request by
 * API_MODE (see src/lib/server/handle-api.ts). The browser always talks
 * same-origin: no CORS, and secrets stay on the backend.
 */
import { handleApi } from "@/lib/server/handle-api";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ path: string[] }> };

async function handle(request: Request, ctx: Ctx) {
  const { path } = await ctx.params;
  return handleApi(request, path);
}

export const GET = handle;
export const POST = handle;
