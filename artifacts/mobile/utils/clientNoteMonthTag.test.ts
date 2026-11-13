import { describe, expect, it } from "vitest";
import {
  formatClientNoteMonth,
  getClientNoteMonthKey,
  parseClientNoteMonthTag,
  parseClientNoteTags,
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

  it("parses built-in category tags with the same yearly codes as the web app", () => {
    expect(parseClientNoteTags("Inviare la CU #CU2026", [], true)).toEqual({
      body: "Inviare la CU",
      monthOverride: null,
      monthOverrides: [],
      categories: ["CU26"],
    });
    expect(parseClientNoteTags("Chiudere il 770 #770", [], true, new Date("2026-05-01T12:00:00.000Z"))).toEqual({
      body: "Chiudere il 770",
      monthOverride: null,
      monthOverrides: [],
      categories: ["77026"],
    });
  });

  it("parses custom declaratives and combines categories with a month tag", () => {
    const declaratives = [{
      id: "5edbd586-6809-4e26-bbd4-448a4bdd671c",
      name: "Dichiarazione dei Redditi",
      alias: "#REDDITI",
    }];
    expect(parseClientNoteTags(
      "Preparare documenti #REDDITI2026 #dicembre26",
      declaratives,
      false,
    )).toEqual({
      body: "Preparare documenti",
      monthOverride: "2026-12",
      monthOverrides: ["2026-12"],
      categories: ["declarative:5edbd586-6809-4e26-bbd4-448a4bdd671c:26"],
    });
  });

  it("rejects built-in categories for other professions unless configured as declaratives", () => {
    expect(parseClientNoteTags("Nota #CU26", [], false)).toEqual({
      body: "Nota #CU26",
      monthOverride: null,
      monthOverrides: [],
      categories: [],
    });
  });

  it("assigns the same note to multiple months, including a spaced two-digit year", () => {
    expect(parseClientNoteTags("Chiamare #dicembre26 e #gennaio 27", [], false)).toEqual({
      body: "Chiamare e",
      monthOverride: "2026-12",
      monthOverrides: ["2026-12", "2027-01"],
      categories: [],
    });
  });
});
