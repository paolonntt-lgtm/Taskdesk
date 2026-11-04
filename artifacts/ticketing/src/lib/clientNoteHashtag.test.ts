import { describe, expect, it } from "vitest";
import { getDefaultNoteMonthOverride, hasClientNoteCategoryTag, parseClientNoteTags, parseHashtag } from "./clientNoteHashtag";

describe("client note hashtag parsing", () => {
  it("recognizes reserved category tags so unsupported profiles can be told clearly", () => {
    expect(hasClientNoteCategoryTag("Nota #cu")).toBe(true);
    expect(hasClientNoteCategoryTag("Nota #77027")).toBe(true);
    expect(hasClientNoteCategoryTag("Nota CU")).toBe(false);
  });

  it("assigns a bare 770 category to the current year", () => {
    expect(parseClientNoteTags("Inviare F24 #770")).toEqual({
      monthOverride: null,
      categories: [`770${String(new Date().getFullYear()).slice(-2)}`],
      strippedBody: "Inviare F24",
    });
  });

  it("assigns a bare CU category to the current year and preserves punctuation", () => {
    expect(parseClientNoteTags("Controllare la pratica #cu, poi richiamare")).toEqual({
      monthOverride: null,
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
      categories: ["77027", "CU27"],
      strippedBody: "Nota",
    });
  });

  it("deduplicates two-digit and four-digit forms of the same annual category", () => {
    expect(parseClientNoteTags("Nota #CU27 #cu2027")).toEqual({
      monthOverride: null,
      categories: ["CU27"],
      strippedBody: "Nota",
    });
  });

  it("combines a category with the existing month override", () => {
    expect(parseClientNoteTags("Inviare CU #CU #marzo26")).toEqual({
      monthOverride: "2026-03",
      categories: [`CU${String(new Date().getFullYear()).slice(-2)}`],
      strippedBody: "Inviare CU",
    });
  });

  it("supports both fixed categories on one note", () => {
    expect(parseClientNoteTags("Nota #770 #CU")).toEqual({
      monthOverride: null,
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
      strippedBody: "Nota",
    });
  });
});
