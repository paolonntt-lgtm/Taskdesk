export const ORGANIZATION_PROFESSIONS = [
  "commercialisti",
  "avvocati",
  "consulenti-del-lavoro",
  "notai",
  "commercio",
  "agenzie",
  "palestre",
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
  palestre: "other",
  it_support: "it_support",
  other: "other",
};

const INITIAL_CATEGORIES_BY_PROFESSION: Record<OrganizationProfession, string[]> = {
  commercialisti: ["Accounting", "Tax Returns", "Payroll", "Corporate", "Client Documents", "Other"],
  avvocati: ["Civil Law", "Criminal Law", "Corporate Law", "Family Law", "Contracts", "Other"],
  "consulenti-del-lavoro": ["Employment", "Payroll", "Social Security", "HR Consulting", "770 / CU", "Other"],
  notai: ["Real Estate", "Succession", "Corporate Acts", "Powers of Attorney", "Contracts", "Other"],
  commercio: ["Orders", "Sales", "Inventory", "Customers", "Suppliers", "Other"],
  agenzie: ["Design", "Development", "Marketing", "Project Management", "Client Request", "Other"],
  palestre: ["Accessi e iscrizioni", "Abbonamenti e pagamenti", "Corsi e prenotazioni", "Attrezzature e struttura", "Altro"],
  it_support: ["PC", "Printer", "Internet / Network", "Software", "Telephony", "Cash register / ERP", "Other"],
  other: ["General", "IT", "Administrative", "Operations", "Other"],
};

export function isOrganizationProfession(value: unknown): value is OrganizationProfession {
  return typeof value === "string" && (ORGANIZATION_PROFESSIONS as readonly string[]).includes(value);
}

export function getOrganizationBusinessType(profession: OrganizationProfession): string {
  return BUSINESS_TYPE_BY_PROFESSION[profession];
}

export function getDefaultCategoriesForProfession(profession: OrganizationProfession): string[] {
  return [...INITIAL_CATEGORIES_BY_PROFESSION[profession]];
}
