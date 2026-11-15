import { describe, expect, it } from "vitest";
import { showDataFlow } from "@/lib/server/flags";

describe("SHOW_DATA_FLOW", () => {
  it("is on when unset, empty or explicitly true", () => {
    expect(showDataFlow({})).toBe(true);
    for (const v of ["", " ", "true", "TRUE", "1", "on", "yes", " true "]) expect(showDataFlow({ SHOW_DATA_FLOW: v })).toBe(true);
  });

  it("is off for any other value, so typos fail closed", () => {
    for (const v of ["false", "0", "off", "no", "disabled", "f", '"false"', "ture"])
      expect(showDataFlow({ SHOW_DATA_FLOW: v })).toBe(false);
  });
});
