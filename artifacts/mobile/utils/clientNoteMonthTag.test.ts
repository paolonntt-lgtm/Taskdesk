import { describe, expect, it } from "vitest";
import {
  formatClientNoteMonth,
  getClientNoteMonthKey,
  parseClientNoteMonthTag,
} from "./clientNoteMonthTag";

describe("mobile client note month hashtags", () => {
  it("removes an Italian month hashtag and extracts its two-digit year", () => {
    expect(parseClientNoteMonthTag("Inviare il riepilogo #dicembre26")).toEqual({
      body: "Inviare il riepilogo",
      monthOverride: "2026-12",
    });
  });

  it("supports a four-digit year and English month names", () => {
    expect(parseClientNoteMonthTag("Call customer #December2027")).toEqual({
      body: "Call customer",
      monthOverride: "2027-12",
    });
  });

  it("uses the Europe/Rome year when the hashtag has no year", () => {
    expect(parseClientNoteMonthTag("Richiamare #dicembre", new Date("2026-12-31T23:30:00.000Z"))).toEqual({
      body: "Richiamare",
      monthOverride: "2027-12",
    });
  });

  it("preserves non-month hashtags such as category tags", () => {
    expect(parseClientNoteMonthTag("Verificare #pratica")).toEqual({
      body: "Verificare #pratica",
      monthOverride: null,
    });
    expect(parseClientNoteMonthTag("Verificare #mese26")).toEqual({
      body: "Verificare #mese26",
      monthOverride: null,
    });
    expect(parseClientNoteMonthTag("Verificare #CU26")).toEqual({
      body: "Verificare #CU26",
      monthOverride: null,
    });
  });

  it("formats the assigned month for the note history badge", () => {
    expect(formatClientNoteMonth("2026-12", "it")).toBe("dicembre 2026");
  });

  it("groups notes by their creation month in Europe/Rome when there is no override", () => {
    expect(getClientNoteMonthKey(null, "2026-12-31T23:30:00.000Z")).toBe("2027-01");
    expect(getClientNoteMonthKey("2026-12", "2026-10-01T10:00:00.000Z")).toBe("2026-12");
  });
});
