import { describe, expect, it } from "vitest";
import { parseAppointmentDate } from "./appointmentDates";

describe("parseAppointmentDate", () => {
  it("keeps date-only all-day input at UTC midnight", () => {
    expect(parseAppointmentDate("2026-10-24", true).toISOString())
      .toBe("2026-10-24T00:00:00.000Z");
  });

  it("uses the written calendar date when an all-day timestamp has an offset", () => {
    expect(parseAppointmentDate("2026-10-24T00:00:00+14:00", true).toISOString())
      .toBe("2026-10-24T00:00:00.000Z");
  });

  it("keeps timed appointment instants unchanged", () => {
    expect(parseAppointmentDate("2026-10-24T00:00:00+14:00", false).toISOString())
      .toBe("2026-10-23T10:00:00.000Z");
  });

  it("rejects invalid all-day calendar dates", () => {
    expect(Number.isNaN(parseAppointmentDate("2026-02-31", true).getTime())).toBe(true);
  });
});
