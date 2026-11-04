import { describe, expect, it } from "vitest";
import { parseClientNoteTags, parseHashtag } from "./clientNoteHashtag";

describe("client note hashtag parsing", () => {
  it("extracts the fixed 770 category and removes the tag from the note", () => {
    expect(parseClientNoteTags("Inviare F24 #770")).toEqual({
      monthOverride: null,
      categories: ["770"],
      strippedBody: "Inviare F24",
    });
  });

  it("normalizes CU and preserves punctuation after the tag", () => {
    expect(parseClientNoteTags("Controllare la pratica #cu, poi richiamare")).toEqual({
      monthOverride: null,
      categories: ["CU"],
      strippedBody: "Controllare la pratica, poi richiamare",
    });
  });

  it("combines a category with the existing month override", () => {
    expect(parseClientNoteTags("Inviare CU #CU #marzo26")).toEqual({
      monthOverride: "2026-03",
      categories: ["CU"],
      strippedBody: "Inviare CU",
    });
  });

  it("supports both fixed categories on one note", () => {
    expect(parseClientNoteTags("Nota #770 #CU")).toEqual({
      monthOverride: null,
      categories: ["770", "CU"],
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
