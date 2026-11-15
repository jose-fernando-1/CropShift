import { describe, expect, it } from "vitest";
import { parseCoordinates } from "@/components/form/coordinate-input";

describe("parseCoordinates", () => {
  it.each([
    ["-8.6, -36.4", { lat: -8.6, lon: -36.4 }],
    ["-8.6 -36.4", { lat: -8.6, lon: -36.4 }],
    ["-8,60; -36,40", { lat: -8.6, lon: -36.4 }],
    ["-8,60 -36,40", { lat: -8.6, lon: -36.4 }],
    ["-8.60,-36.40", { lat: -8.6, lon: -36.4 }],
  ])("parses %s", (text, expected) => {
    expect(parseCoordinates(text)).toEqual(expected);
  });
  it.each(["north", "-8.6", "100, 0", "-8,6,-36,4"])("rejects %s", (text) => {
    expect(parseCoordinates(text)).toBeNull();
  });
});
