import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, organizationsTable, settingsTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

const CATEGORIES_BY_TYPE: Record<string, string[]> = {
  it_support: ["PC", "Printer", "Internet / Network", "Software", "Telephony", "Cash register / ERP", "Other"],
  professional_studio: ["Tax", "Corporate", "Contractual", "Consulting", "Administrative", "Other"],
  agency: ["Design", "Development", "Marketing", "Project Management", "Client Request", "Other"],
  other: ["General", "IT", "Administrative", "Operations", "Other"],
};

const VALID_TYPES = Object.keys(CATEGORIES_BY_TYPE);
const PROFILE_BUSINESS_TYPES: Record<string, string> = {
  commercialisti: "professional_studio",
  avvocati: "professional_studio",
  "consulenti-del-lavoro": "professional_studio",
  notai: "professional_studio",
  commercio: "other",
  agenzie: "agency",
  it_support: "it_support",
  other: "other",
};

router.post("/onboarding/complete", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const { businessType, profession } = req.body ?? {};

  if (!businessType || !VALID_TYPES.includes(businessType) || !profession || PROFILE_BUSINESS_TYPES[profession] !== businessType) {
    res.status(400).json({ message: "Tipo di attività non valido" });
    return;
  }

  if (!currentUser.organizationId) {
    res.status(400).json({ message: "Organizzazione non trovata" });
    return;
  }

  const [existingOrganization] = await db
    .select({ onboardingDone: organizationsTable.onboardingDone })
    .from(organizationsTable)
    .where(eq(organizationsTable.id, currentUser.organizationId));

  if (!existingOrganization) {
    res.status(400).json({ message: "Organizzazione non trovata" });
    return;
  }

  const categories = CATEGORIES_BY_TYPE[businessType];

  const orgKey = `org_${currentUser.organizationId}_categories`;
  const organizationUpdate: { businessType: string; onboardingDone: boolean; profession?: string } = {
    businessType,
    onboardingDone: true,
  };
  // The exact onboarding profile is only collected for organizations completing onboarding now.
  if (!existingOrganization.onboardingDone) organizationUpdate.profession = profession;

  const operations = [
    db
      .update(organizationsTable)
      .set(organizationUpdate)
      .where(eq(organizationsTable.id, currentUser.organizationId)),
    db
      .insert(settingsTable)
      .values({ key: orgKey, value: JSON.stringify(categories) })
      .onConflictDoUpdate({ target: settingsTable.key, set: { value: JSON.stringify(categories) } }),
  ];

  if (!existingOrganization.onboardingDone) {
    const featureKey = `org_${currentUser.organizationId}_auto_collaborator_dashboard_widgets`;
    operations.push(
      db
        .insert(settingsTable)
        .values({ key: featureKey, value: "true" })
        .onConflictDoUpdate({ target: settingsTable.key, set: { value: "true" } }),
    );
  }

  await Promise.all(operations);

  res.json({ success: true, businessType, profession: organizationUpdate.profession ?? null, categories });
});

export default router;
