import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, settingsTable, organizationsTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

const DEFAULT_LOCATIONS = ["Sede A", "Sede B", "Sede C"];
const DEFAULT_CATEGORIES = [
  "PC",
  "Stampante",
  "Internet / Rete",
  "Software",
  "Telefonia",
  "Cassa / Gestionale",
  "Altro",
];
const DEFAULT_GROUPS = ["IT Support", "Reception", "Amministrazione"];

function orgKey(orgId: number | null | undefined, base: string): string {
  return orgId != null ? `org_${orgId}_${base}` : base;
}

async function getSetting(key: string, defaultValue: string[]): Promise<string[]> {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
  if (!row) return defaultValue;
  try {
    return JSON.parse(row.value);
  } catch {
    return defaultValue;
  }
}

router.get("/settings/locations", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const key = orgKey(currentUser.organizationId, "locations");
  const value = await getSetting(key, DEFAULT_LOCATIONS);
  res.json({ value });
});

router.get("/settings/categories", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const key = orgKey(currentUser.organizationId, "categories");
  const value = await getSetting(key, DEFAULT_CATEGORIES);
  res.json({ value });
});

router.put("/settings/locations", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { value } = req.body ?? {};
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) {
    res.status(400).json({ message: "Valore non valido: deve essere un array di stringhe" });
    return;
  }
  const currentUser = (req as any).currentUser;
  const key = orgKey(currentUser.organizationId, "locations");
  const cleaned = value.map((v: string) => v.trim()).filter(Boolean);
  await db
    .insert(settingsTable)
    .values({ key, value: JSON.stringify(cleaned) })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value: JSON.stringify(cleaned) } });
  res.json({ value: cleaned });
});

router.put("/settings/categories", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { value } = req.body ?? {};
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) {
    res.status(400).json({ message: "Valore non valido: deve essere un array di stringhe" });
    return;
  }
  const currentUser = (req as any).currentUser;
  const key = orgKey(currentUser.organizationId, "categories");
  const cleaned = value.map((v: string) => v.trim()).filter(Boolean);
  await db
    .insert(settingsTable)
    .values({ key, value: JSON.stringify(cleaned) })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value: JSON.stringify(cleaned) } });
  res.json({ value: cleaned });
});

router.get("/settings/groups", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const key = orgKey(currentUser.organizationId, "groups");
  const value = await getSetting(key, DEFAULT_GROUPS);
  res.json({ value });
});

router.put("/settings/groups", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { value } = req.body ?? {};
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) {
    res.status(400).json({ message: "Valore non valido: deve essere un array di stringhe" });
    return;
  }
  const currentUser = (req as any).currentUser;
  const key = orgKey(currentUser.organizationId, "groups");
  const cleaned = value.map((v: string) => v.trim()).filter(Boolean);
  await db
    .insert(settingsTable)
    .values({ key, value: JSON.stringify(cleaned) })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value: JSON.stringify(cleaned) } });
  res.json({ value: cleaned });
});

router.get("/settings/organization", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  if (!currentUser.organizationId) {
    res.status(404).json({ message: "Organizzazione non trovata" });
    return;
  }
  const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, currentUser.organizationId));
  if (!org) {
    res.status(404).json({ message: "Organizzazione non trovata" });
    return;
  }
  res.json({ name: org.name });
});

router.put("/settings/organization", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { name } = req.body ?? {};
  if (typeof name !== "string" || name.trim().length < 2) {
    res.status(400).json({ message: "Il nome azienda deve avere almeno 2 caratteri" });
    return;
  }
  const currentUser = (req as any).currentUser;
  if (!currentUser.organizationId) {
    res.status(404).json({ message: "Organizzazione non trovata" });
    return;
  }
  const [updated] = await db
    .update(organizationsTable)
    .set({ name: name.trim() })
    .where(eq(organizationsTable.id, currentUser.organizationId))
    .returning();
  res.json({ name: updated.name });
});

export default router;
