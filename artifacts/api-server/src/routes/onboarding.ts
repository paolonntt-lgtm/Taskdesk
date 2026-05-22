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

router.post("/onboarding/complete", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const { businessType } = req.body ?? {};

  if (!businessType || !VALID_TYPES.includes(businessType)) {
    res.status(400).json({ message: "Tipo di attività non valido" });
    return;
  }

  if (!currentUser.organizationId) {
    res.status(400).json({ message: "Organizzazione non trovata" });
    return;
  }

  const categories = CATEGORIES_BY_TYPE[businessType];

  const orgKey = `org_${currentUser.organizationId}_categories`;

  await Promise.all([
    db
      .update(organizationsTable)
      .set({ businessType, onboardingDone: true })
      .where(eq(organizationsTable.id, currentUser.organizationId)),
    db
      .insert(settingsTable)
      .values({ key: orgKey, value: JSON.stringify(categories) })
      .onConflictDoUpdate({ target: settingsTable.key, set: { value: JSON.stringify(categories) } }),
  ]);

  res.json({ success: true, businessType, categories });
});

export default router;
