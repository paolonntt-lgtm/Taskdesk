import { describe, expect, it } from "vitest";
import { hasConfirmedTrialRegistration, parseProfessionalTrialAttribution } from "./professionalTrialAttribution";

describe("professional trial attribution", () => {
  it("accepts only allowlisted profession and language values", () => {
    expect(parseProfessionalTrialAttribution("?trial_profession=avvocati&trial_language=en&email=person%40example.com"))
      .toEqual({ profession: "avvocati", language: "en" });
    for (const profession of ["notai", "commercio", "agenzie"] as const) {
      expect(parseProfessionalTrialAttribution(`?trial_profession=${profession}&trial_language=it`))
        .toEqual({ profession, language: "it" });
    }
    expect(parseProfessionalTrialAttribution("?trial_profession=someone%40example.com&trial_language=en")).toBeNull();
    expect(parseProfessionalTrialAttribution("?trial_profession=avvocati&trial_language=fr")).toBeNull();
    expect(parseProfessionalTrialAttribution("?trial_profession=avvocati")).toBeNull();
  });

  it("requires a successful registration response containing an unexpired trial", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(hasConfirmedTrialRegistration(201, { trialEndsAt: future })).toBe(true);
    expect(hasConfirmedTrialRegistration(400, { trialEndsAt: future })).toBe(false);
    expect(hasConfirmedTrialRegistration(201, {})).toBe(false);
    expect(hasConfirmedTrialRegistration(201, { trialEndsAt: "not-a-date" })).toBe(false);
    expect(hasConfirmedTrialRegistration(201, { trialEndsAt: new Date(Date.now() - 60_000).toISOString() })).toBe(false);
  });
});
