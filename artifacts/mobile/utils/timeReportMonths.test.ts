import { describe, expect, it } from "vitest";
import { getMonthRange, getRecentMonthOptions } from "./timeReportMonths";

describe("hours report month filters", () => {
  it("returns full calendar month boundaries including leap February", () => {
    expect(getMonthRange("2024-02")).toEqual({
      dateFrom: "2024-02-01",
      dateTo: "2024-02-29",
    });
    expect(getMonthRange("2025-02")).toEqual({
      dateFrom: "2025-02-01",
      dateTo: "2025-02-28",
    });
    expect(getMonthRange("2025-13")).toBeNull();
  });

  it("lists recent months newest first with localized month-year labels", () => {
    const options = getRecentMonthOptions(3, new Date(2026, 0, 15), "it-IT");
    expect(options.map(({ value }) => value)).toEqual(["2026-01", "2025-12", "2025-11"]);
    expect(options[0].label).toContain("gennaio");
    expect(options[1]).toMatchObject({ dateFrom: "2025-12-01", dateTo: "2025-12-31" });
  });
});
