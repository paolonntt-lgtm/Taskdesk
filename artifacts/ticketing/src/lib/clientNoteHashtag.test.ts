import { describe, expect, it } from "vitest";
import { getDefaultNoteMonthOverride, hasClientNoteCategoryTag, hasDeclarativeClientNoteCategory, hasUnavailableBuiltInClientNoteTag, parseClientNoteTags, parseHashtag } from "./clientNoteHashtag";

describe("client note hashtag parsing", () => {
  it("identifies custom and built-in declaration categories", () => {
    expect(hasDeclarativeClientNoteCategory(["declarative:cb73ea3c-e70f-4de0-97c6-5946f6bdfe5f:27"])).toBe(true);
    expect(hasDeclarativeClientNoteCategory(["declarative:cb73ea3c-e70f-4de0-97c6-5946f6bdfe5f"])).toBe(true);
    expect(hasDeclarativeClientNoteCategory(["CU27", "77027"])).toBe(true);
    expect(hasDeclarativeClientNoteCategory(["ordinary", null])).toBe(false);
    expect(hasDeclarativeClientNoteCategory(null)).toBe(false);
  });

  it("recognizes reserved category tags so unsupported profiles can be told clearly", () => {
    expect(hasClientNoteCategoryTag("Nota #cu")).toBe(true);
    expect(hasClientNoteCategoryTag("Nota #77027")).toBe(true);
    expect(hasClientNoteCategoryTag("Nota CU")).toBe(false);
  });

  it("assigns a bare 770 category to the current year", () => {
    expect(parseClientNoteTags("Inviare F24 #770")).toEqual({
      monthOverride: null,
      monthOverrides: [],
      categories: [`770${String(new Date().getFullYear()).slice(-2)}`],
      strippedBody: "Inviare F24",
    });
  });

  it("assigns a bare CU category to the current year and preserves punctuation", () => {
    expect(parseClientNoteTags("Controllare la pratica #cu, poi richiamare")).toEqual({
      monthOverride: null,
      monthOverrides: [],
      categories: [`CU${String(new Date().getFullYear()).slice(-2)}`],
      strippedBody: "Controllare la pratica, poi richiamare",
    });
  });

  it("does not assign a month to annual-category-only notes", () => {
    expect(getDefaultNoteMonthOverride(null, ["CU26"], new Date(2026, 10, 4))).toBeNull();
  });

  it("keeps the current-month default for notes without categories", () => {
    expect(getDefaultNoteMonthOverride(null, [], new Date(2026, 10, 4))).toBe("2026-11");
  });

  it("preserves an explicit month when a category is also present", () => {
    expect(getDefaultNoteMonthOverride("2027-03", ["CU27"], new Date(2026, 10, 4))).toBe("2027-03");
  });

  it("keeps explicit annual categories separate and normalizes four-digit years", () => {
    expect(parseClientNoteTags("Nota #77027 #cu2027")).toEqual({
      monthOverride: null,
      monthOverrides: [],
      categories: ["77027", "CU27"],
      strippedBody: "Nota",
    });
  });

  it("deduplicates two-digit and four-digit forms of the same annual category", () => {
    expect(parseClientNoteTags("Nota #CU27 #cu2027")).toEqual({
      monthOverride: null,
      monthOverrides: [],
      categories: ["CU27"],
      strippedBody: "Nota",
    });
  });

  it("combines a category with the existing month override", () => {
    expect(parseClientNoteTags("Inviare CU #CU #marzo26")).toEqual({
      monthOverride: "2026-03",
      monthOverrides: ["2026-03"],
      categories: [`CU${String(new Date().getFullYear()).slice(-2)}`],
      strippedBody: "Inviare CU",
    });
  });

  it("supports both fixed categories on one note", () => {
    expect(parseClientNoteTags("Nota #770 #CU")).toEqual({
      monthOverride: null,
      monthOverrides: [],
      categories: [
        `770${String(new Date().getFullYear()).slice(-2)}`,
        `CU${String(new Date().getFullYear()).slice(-2)}`,
      ],
      strippedBody: "Nota",
    });
  });

  it("keeps month hashtag behavior unchanged", () => {
    expect(parseHashtag("Nota #agosto26")).toEqual({
      monthOverride: "2026-08",
      monthOverrides: ["2026-08"],
      strippedBody: "Nota",
    });
  });

  it("uses the current year when a month hashtag has no year", () => {
    const year = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Rome', year: 'numeric' }).format(new Date());
    expect(parseHashtag("Richiamare il cliente #marzo")).toEqual({
      monthOverride: `${year}-03`,
      monthOverrides: [`${year}-03`],
      strippedBody: "Richiamare il cliente",
    });
  });

  it("does not treat unrelated bare hashtags as months", () => {
    expect(parseHashtag("Confermare #documenti")).toBeNull();
  });

  it("assigns one note to multiple months and accepts a spaced year", () => {
    expect(parseClientNoteTags("Nota #dicembre26 #gennaio 27", [], false)).toEqual({
      monthOverride: "2026-12",
      monthOverrides: ["2026-12", "2027-01"],
      categories: [],
      strippedBody: "Nota",
    });
  });

  it("maps configured aliases to organization declarative categories", () => {
    const declaratives = [{ id: "cb73ea3c-e70f-4de0-97c6-5946f6bdfe5f", name: "Ritenute", alias: "#RIT" }];
    expect(parseClientNoteTags("Verificare pagamento #rit.", declaratives, false)).toEqual({
      monthOverride: null,
      monthOverrides: [],
      categories: [`declarative:${declaratives[0].id}:${new Intl.DateTimeFormat('en', { timeZone: 'Europe/Rome', year: '2-digit' }).format(new Date())}`],
      strippedBody: "Verificare pagamento.",
    });
  });

  it("uses an explicit year suffix for custom declaratives", () => {
    const declaratives = [{ id: "cb73ea3c-e70f-4de0-97c6-5946f6bdfe5f", name: "Redditi", alias: "#REDDITI" }];
    expect(parseClientNoteTags("Dichiarazione #redditi2027", declaratives, false)).toEqual({
      monthOverride: null,
      monthOverrides: [],
      categories: [`declarative:${declaratives[0].id}:27`],
      strippedBody: "Dichiarazione",
    });
  });

  it("allows custom aliases on other professions but rejects unconfigured built-ins", () => {
    const declaratives = [{ id: "cb73ea3c-e70f-4de0-97c6-5946f6bdfe5f", name: "CU", alias: "#CU" }];
    expect(hasUnavailableBuiltInClientNoteTag("Nota #CU", false, declaratives)).toBe(false);
    expect(hasUnavailableBuiltInClientNoteTag("Nota #77026", false, declaratives)).toBe(true);
    expect(parseClientNoteTags("Nota #CU2027", declaratives, false)?.categories).toEqual([
      `declarative:${declaratives[0].id}:27`,
    ]);
  });

  it("uses the existing CU card for the labor-consultant CU default", () => {
    const declaratives = [{ id: "cb73ea3c-e70f-4de0-97c6-5946f6bdfe5f", name: "CU", alias: "#CU" }];
    expect(parseClientNoteTags("Nota #CU", declaratives, true)?.categories).toEqual([
      `CU${new Intl.DateTimeFormat('en', { timeZone: 'Europe/Rome', year: '2-digit' }).format(new Date())}`,
    ]);
  });
});
