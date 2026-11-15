import { describe, expect, it } from "vitest";
import { dekadLabel, dekadOfDate, shiftDekad, windowLabel, windowLength } from "@/lib/domain/dekads";

describe("dekads", () => {
  it("maps dekads to calendar ranges (dekad 1 = Jan 1-10)", () => {
    expect(dekadLabel(1)).toBe("Jan 1–10");
    expect(dekadLabel(6)).toBe("Feb 21–28");
    expect(dekadLabel(12)).toBe("Apr 21–30");
    expect(dekadLabel(36)).toBe("Dec 21–31");
  });

  it("labels windows and handles wrap past the year end", () => {
    expect(windowLabel(12, 15)).toBe("Apr 21 – May 31");
    expect(windowLabel(36, 2)).toBe("Dec 21 – Jan 20");
    expect(windowLength(36, 2)).toBe(3);
    expect(shiftDekad(36, 1)).toBe(1);
    expect(shiftDekad(1, -1)).toBe(36);
  });

  it("finds the dekad of a date", () => {
    expect(dekadOfDate(new Date(2026, 3, 21))).toBe(12);
    expect(dekadOfDate(new Date(2026, 10, 15))).toBe(32);
  });
});
