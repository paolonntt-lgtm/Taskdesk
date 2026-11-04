export const ORGANIZATION_PROFESSIONS = [
  "commercialisti",
  "avvocati",
  "consulenti-del-lavoro",
  "notai",
  "commercio",
  "agenzie",
  "it_support",
  "other",
] as const;

export type OrganizationProfession = typeof ORGANIZATION_PROFESSIONS[number];

const BUSINESS_TYPE_BY_PROFESSION: Record<OrganizationProfession, string> = {
  commercialisti: "professional_studio",
  avvocati: "professional_studio",
  "consulenti-del-lavoro": "professional_studio",
  notai: "professional_studio",
  commercio: "other",
  agenzie: "agency",
  it_support: "it_support",
  other: "other",
};

export function isOrganizationProfession(value: unknown): value is OrganizationProfession {
  return typeof value === "string" && (ORGANIZATION_PROFESSIONS as readonly string[]).includes(value);
}

export function getOrganizationBusinessType(profession: OrganizationProfession): string {
  return BUSINESS_TYPE_BY_PROFESSION[profession];
}
