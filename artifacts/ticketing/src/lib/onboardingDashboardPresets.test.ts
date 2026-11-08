import { describe, expect, it } from "vitest";
import {
  getOnboardingBusinessType,
  getOnboardingDashboardPreset,
  isProfessionalDashboardPresetId,
  type ProfessionalDashboardPresetId,
} from "./onboardingDashboardPresets";

describe("profession-based onboarding presets", () => {
  const professions: ProfessionalDashboardPresetId[] = [
    "commercialisti",
    "avvocati",
    "consulenti-del-lavoro",
    "notai",
    "commercio",
    "agenzie",
    "palestre",
  ];

  it("maps each supported profession to a business type and a non-empty widget selection", () => {
    for (const profession of professions) {
      expect(isProfessionalDashboardPresetId(profession)).toBe(true);
      expect(getOnboardingBusinessType(profession)).toMatch(/^(professional_studio|other|agency)$/);
      expect(getOnboardingDashboardPreset(profession).length).toBeGreaterThan(0);
    }
  });

  it("rejects unrecognized values, including inherited object properties", () => {
    expect(isProfessionalDashboardPresetId("unknown")).toBe(false);
    expect(isProfessionalDashboardPresetId("toString")).toBe(false);
    expect(isProfessionalDashboardPresetId(null)).toBe(false);
  });

  it("retains generic dashboard setups for IT support and other organizations", () => {
    expect(getOnboardingBusinessType("it_support")).toBe("it_support");
    expect(getOnboardingBusinessType("other")).toBe("other");
    expect(getOnboardingDashboardPreset("it_support")).toContain("chart-trend");
    expect(getOnboardingDashboardPreset("other")).toContain("feed-recent");
  });

  it("gives gyms the general business type with an operations dashboard", () => {
    expect(getOnboardingBusinessType("palestre")).toBe("other");
    expect(getOnboardingDashboardPreset("palestre")).toContain("feed-assigned");
    expect(getOnboardingDashboardPreset("palestre")).toContain("chart-status");
  });
});
