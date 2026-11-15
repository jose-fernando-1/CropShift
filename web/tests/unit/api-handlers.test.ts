import { describe, expect, it } from "vitest";
import * as S from "@/contract/schemas";
import { handleMock } from "@/mocks/handlers";

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  handleMock(
    new Request(`http://test/api/${path}`, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", ...headers } }),
    path.split("/"),
  );
const get = (path: string) => handleMock(new Request(`http://test/api/${path}`), path.split("/"));

describe("mock API", () => {
  it("serves health and crops per contract", async () => {
    expect(S.Health.parse(await (await get("health")).json()).mock).toBe(true);
    const crops = S.CropsResponse.parse(await (await get("v1/crops")).json());
    expect(crops.crops.find((c) => c.crop_id === "castor")?.gate.status).toBe("failed");
  });

  it("resolves covered and out-of-state points", async () => {
    const covered = S.ResolveResponse.parse(await (await post("v1/locations/resolve", { lat: -8.6, lon: -36.4 })).json());
    expect(covered.coverage).toBe("covered");
    const out = S.ResolveResponse.parse(await (await post("v1/locations/resolve", { lat: -12.97, lon: -38.5 })).json());
    expect(out.coverage).toBe("out_of_state");
    const bad = await post("v1/locations/resolve", { lat: 200, lon: 0 });
    expect(bad.status).toBe(422);
    expect(S.ApiError.parse(await bad.json()).error.code).toBe("invalid_coordinates");
  });

  it("recommends by point with defaults, then explains", async () => {
    const res = await post("v1/recommendations", { lat: -8.6, lon: -36.4 });
    const rec = S.Recommendation.parse(await res.json());
    expect(rec.location).toMatchObject({ municipality_code: "2613008", soil_source: "default", regime_source: "default", input_mode: "point" });
    const ex = S.Explanation.parse(await (await post(`v1/recommendations/${rec.analysis_id}/explain`, {})).json());
    expect(ex.source).toBe("template");
    expect(ex.analysis_id).toBe(rec.analysis_id);
  });

  it("returns contract errors for bad input, outside PE and unknown ids", async () => {
    const extra = await post("v1/recommendations", { municipality_code: "2613008", soil_class: 9 });
    expect(S.ApiError.parse(await extra.json()).error.code).toBe("invalid_request");
    const outside = await post("v1/recommendations", { lat: -12.97, lon: -38.5 });
    expect(S.ApiError.parse(await outside.json()).error.code).toBe("out_of_coverage");
    const unknown = await post("v1/recommendations/xyz/explain", {});
    expect(unknown.status).toBe(404);
    expect((await get("v1/nope")).status).toBe(404);
  });

  it("simulates failure scenarios", async () => {
    const down = await post("v1/recommendations", { municipality_code: "2613008" }, { "x-mock-scenario": "power_down" });
    expect(down.status).toBe(503);
    expect(S.ApiError.parse(await down.json()).error.code).toBe("upstream_unavailable");
    const noData = await post("v1/recommendations", { municipality_code: "2613008" }, { "x-mock-scenario": "no_data" });
    expect(noData.status).toBe(404);
  });
});

describe("route allowlist", () => {
  it("rejects paths outside the contract and unsafe segments", async () => {
    const { isContractRoute } = await import("@/lib/server/routes");
    expect(isContractRoute("GET", ["health"])).toBe(true);
    expect(isContractRoute("POST", ["v1", "recommendations", "csm_1_2613008.2.d.r.d.p.1", "explain"])).toBe(true);
    expect(isContractRoute("GET", ["docs"])).toBe(false);
    expect(isContractRoute("GET", ["..", "..", "docs"])).toBe(false);
    expect(isContractRoute("POST", ["v1", "recommendations", "x/../../secret", "explain"])).toBe(false);
    expect(isContractRoute("POST", ["v1", "recommendations", "x?a=1#", "explain"])).toBe(false);
    expect(isContractRoute("POST", ["v1", "crops"])).toBe(false);
  });
});
