export type ProfessionalTrialAttribution = {
  profession: "commercialisti" | "avvocati" | "consulenti-del-lavoro";
  language: "it" | "en";
};

const PROFESSIONS = new Set<ProfessionalTrialAttribution["profession"]>([
  "commercialisti",
  "avvocati",
  "consulenti-del-lavoro",
]);
const LANGUAGES = new Set<ProfessionalTrialAttribution["language"]>(["it", "en"]);

export function parseProfessionalTrialAttribution(search: string): ProfessionalTrialAttribution | null {
  const params = new URLSearchParams(search);
  const profession = params.get("trial_profession");
  const language = params.get("trial_language");

  if (!profession || !PROFESSIONS.has(profession as ProfessionalTrialAttribution["profession"])) return null;
  if (!language || !LANGUAGES.has(language as ProfessionalTrialAttribution["language"])) return null;

  return {
    profession: profession as ProfessionalTrialAttribution["profession"],
    language: language as ProfessionalTrialAttribution["language"],
  };
}

export function hasConfirmedTrialRegistration(status: number, user: unknown): boolean {
  if (status !== 201 || !user || typeof user !== "object" || !("trialEndsAt" in user)) return false;
  const trialEndsAt = user.trialEndsAt;
  if (typeof trialEndsAt !== "string") return false;
  const timestamp = Date.parse(trialEndsAt);
  return Number.isFinite(timestamp) && timestamp > Date.now();
}
