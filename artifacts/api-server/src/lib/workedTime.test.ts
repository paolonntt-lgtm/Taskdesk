import { describe, expect, it } from "vitest";
import { isValidWorkedMinutes, parseWorkedTimeFields } from "./workedTime";

describe("worked time", () => {
  it("converts whole hours to minutes", () => {
    expect(parseWorkedTimeFields("2", "")).toEqual({ total: 120 });
  });

  it("converts hours and minutes without decimal ambiguity", () => {
    expect(parseWorkedTimeFields("2", "30")).toEqual({ total: 150 });
  });

  it("accepts a partially filled duration by treating the missing field as zero", () => {
    expect(parseWorkedTimeFields("", "15")).toEqual({ total: 15 });
    expect(parseWorkedTimeFields("2", "")).toEqual({ total: 120 });
  });

  it("allows an empty optional duration", () => {
    expect(parseWorkedTimeFields("", "")).toEqual({ total: null });
  });

  it("rejects negative hours and minutes outside 0-59", () => {
    expect(parseWorkedTimeFields("-1", "0")).toEqual({ total: null, error: "hours" });
    expect(parseWorkedTimeFields("1", "60")).toEqual({ total: null, error: "minutes" });
  });

  it("accepts only non-negative integer totals at the API boundary", () => {
    expect(isValidWorkedMinutes(null)).toBe(true);
    expect(isValidWorkedMinutes(undefined)).toBe(true);
    expect(isValidWorkedMinutes(150)).toBe(true);
    expect(isValidWorkedMinutes(2.5)).toBe(false);
    expect(isValidWorkedMinutes(-1)).toBe(false);
  });
});