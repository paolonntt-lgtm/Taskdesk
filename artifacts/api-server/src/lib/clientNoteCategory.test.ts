import { describe, expect, it } from "vitest";
import { normalizeClientNoteCategory } from "./clientNoteCategory";

describe("normalizeClientNoteCategory", () => {
  it("defaults a bare category to the current year in Rome", () => {
    const year = new Intl.DateTimeFormat("en", {
      timeZone: "Europe/Rome",
      year: "2-digit",
    }).format(new Date());

    expect(normalizeClientNoteCategory("770")).toBe(`770${year}`);
  });

  it("normalizes two-digit and four-digit category years", () => {
    expect(normalizeClientNoteCategory("cu27")).toBe("CU27");
    expect(normalizeClientNoteCategory("CU2027")).toBe("CU27");
    expect(normalizeClientNoteCategory("declarative:cb73ea3c-e70f-4de0-97c6-5946f6bdfe5f:2027")).toBe("declarative:cb73ea3c-e70f-4de0-97c6-5946f6bdfe5f:27");
  });

  it("rejects invalid categories and year lengths", () => {
    expect(normalizeClientNoteCategory("CU2")).toBeNull();
    expect(normalizeClientNoteCategory("77020270")).toBeNull();
    expect(normalizeClientNoteCategory("#CU27")).toBeNull();
  });
});
