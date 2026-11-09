import { describe, expect, it } from "vitest";
import { clientNoteMonthKeyFromDate, getClientNoteMonthKey } from "./clientNoteMonth";

describe("client note month keys", () => {
  it("uses the Europe/Rome calendar month around UTC month boundaries", () => {
    expect(clientNoteMonthKeyFromDate("2026-09-30T22:30:00.000Z")).toBe("2026-10");
    expect(clientNoteMonthKeyFromDate("2026-10-31T23:30:00.000Z")).toBe("2026-11");
  });

  it("keeps an explicitly selected month override", () => {
    expect(getClientNoteMonthKey("2026-10", "2026-09-30T22:30:00.000Z")).toBe("2026-10");
  });
});
