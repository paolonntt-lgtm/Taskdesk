import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, organizationsTable, settingsTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import {
  getDefaultCategoriesForProfession,
  getOrganizationBusinessType,
  isOrganizationProfession,
} from "../lib/organizationProfession";

const router: IRouter = Router();

const CATEGORIES_BY_TYPE: Record<string, string[]> = {
  it_support: ["PC", "Printer", "Internet / Network", "Software", "Telephony", "Cash register / ERP", "Other"],
  professional_studio: ["Tax", "Corporate", "Contractual", "Consulting", "Administrative", "Other"],
  agency: ["Design", "Development", "Marketing", "Project Management", "Client Request", "Other"],
  other: ["General", "IT", "Administrative", "Operations", "Other"],
};

function sameCategories(left: unknown, right: string[]): boolean {
  return Array.isArray(left)
    && left.every((value) => typeof value === "string")
    && JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

router.post("/onboarding/complete", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const { businessType, profession } = req.body ?? {};

  if (!isOrganizationProfession(profession) || businessType !== getOrganizationBusinessType(profession)) {
    res.status(400).json({ message: "Tipo di attività non valido" });
    return;
  }

  if (!currentUser.organizationId) {
    res.status(400).json({ message: "Organizzazione non trovata" });
    return;
  }

  const [existingOrganization] = await db
    .select({
      onboardingDone: organizationsTable.onboardingDone,
      profession: organizationsTable.profession,
      businessType: organizationsTable.businessType,
    })
    .from(organizationsTable)
    .where(eq(organizationsTable.id, currentUser.organizationId));

  if (!existingOrganization) {
    res.status(400).json({ message: "Organizzazione non trovata" });
    return;
  }

  const orgKey = `org_${currentUser.organizationId}_categories`;
  const categories = getDefaultCategoriesForProfession(profession);
  const [existingCategorySetting] = await db
    .select({ value: settingsTable.value })
    .from(settingsTable)
    .where(eq(settingsTable.key, orgKey));
  let savedCategories = categories;
  let replaceExistingDefault = false;

  if (existingCategorySetting) {
    try {
      const parsedCategories: unknown = JSON.parse(existingCategorySetting.value);
      const previousDefaults = isOrganizationProfession(existingOrganization.profession)
        ? getDefaultCategoriesForProfession(existingOrganization.profession)
        : CATEGORIES_BY_TYPE[existingOrganization.businessType ?? ""];
      replaceExistingDefault = !existingOrganization.onboardingDone
        && !!previousDefaults
        && sameCategories(parsedCategories, previousDefaults);
      if (!replaceExistingDefault && Array.isArray(parsedCategories)
        && parsedCategories.every((value) => typeof value === "string")) {
        savedCategories = parsedCategories;
      }
    } catch {
      // Preserve malformed or user-managed settings rather than replacing them.
    }
  }

  const organizationUpdate = {
    businessType,
    onboardingDone: true,
    profession,
  };

  const operations: Array<PromiseLike<unknown>> = [
    db
      .update(organizationsTable)
      .set(organizationUpdate)
      .where(eq(organizationsTable.id, currentUser.organizationId)),
  ];

  if (!existingCategorySetting) {
    operations.push(
      db.insert(settingsTable)
        .values({ key: orgKey, value: JSON.stringify(categories) })
        .onConflictDoNothing(),
    );
  } else if (replaceExistingDefault) {
    operations.push(
      db.update(settingsTable)
        .set({ value: JSON.stringify(categories) })
        .where(eq(settingsTable.key, orgKey)),
    );
  }

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

  res.json({ success: true, businessType, profession, categories: savedCategories });
});

export default router;
