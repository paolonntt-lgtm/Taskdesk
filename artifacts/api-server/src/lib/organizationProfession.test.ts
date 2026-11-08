import { describe, expect, it } from "vitest";
import {
  getDefaultCategoriesForProfession,
  getOrganizationBusinessType,
  ORGANIZATION_PROFESSIONS,
} from "./organizationProfession";

describe("organization profession presets", () => {
  it("provides non-empty category lists and the matching business type for every profession", () => {
    for (const profession of ORGANIZATION_PROFESSIONS) {
      expect(getDefaultCategoriesForProfession(profession).length).toBeGreaterThan(0);
      expect(getDefaultCategoriesForProfession(profession)).toContain("Other");
      expect(getOrganizationBusinessType(profession)).toMatch(
        /^(it_support|professional_studio|agency|other)$/,
      );
    }
  });

  it("uses distinct category presets for all professional profiles", () => {
    const professionalProfiles = [
      "commercialisti",
      "avvocati",
      "consulenti-del-lavoro",
      "notai",
      "commercio",
      "agenzie",
      "palestre",
    ] as const;
    const presetSignatures = professionalProfiles.map((profession) =>
      getDefaultCategoriesForProfession(profession).join("|"),
    );

    expect(new Set(presetSignatures).size).toBe(professionalProfiles.length);
  });

  it("sets up gym-specific categories under the general business type", () => {
    expect(getOrganizationBusinessType("palestre")).toBe("other");
    expect(getDefaultCategoriesForProfession("palestre")).toEqual([
      "Accessi e iscrizioni",
      "Abbonamenti e pagamenti",
      "Corsi e prenotazioni",
      "Attrezzature e struttura",
      "Altro",
    ]);
  });

  it("returns a fresh category list for callers", () => {
    const first = getDefaultCategoriesForProfession("avvocati");
    first.push("Custom");

    expect(getDefaultCategoriesForProfession("avvocati")).not.toContain("Custom");
  });
});
