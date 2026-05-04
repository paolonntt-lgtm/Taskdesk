import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, settingsTable } from "@workspace/db";
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

async function getSetting(key: string, defaultValue: string[]): Promise<string[]> {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
  if (!row) return defaultValue;
  try {
    return JSON.parse(row.value);
  } catch {
    return defaultValue;
  }
}

router.get("/settings/locations", requireAuth, async (_req, res): Promise<void> => {
  const value = await getSetting("locations", DEFAULT_LOCATIONS);
  res.json({ value });
});

router.get("/settings/categories", requireAuth, async (_req, res): Promise<void> => {
  const value = await getSetting("categories", DEFAULT_CATEGORIES);
  res.json({ value });
});

router.put("/settings/locations", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { value } = req.body ?? {};
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) {
    res.status(400).json({ message: "Valore non valido: deve essere un array di stringhe" });
    return;
  }
  const cleaned = value.map((v: string) => v.trim()).filter(Boolean);
  await db
    .insert(settingsTable)
    .values({ key: "locations", value: JSON.stringify(cleaned) })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value: JSON.stringify(cleaned) } });
  res.json({ value: cleaned });
});

router.put("/settings/categories", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { value } = req.body ?? {};
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) {
    res.status(400).json({ message: "Valore non valido: deve essere un array di stringhe" });
    return;
  }
  const cleaned = value.map((v: string) => v.trim()).filter(Boolean);
  await db
    .insert(settingsTable)
    .values({ key: "categories", value: JSON.stringify(cleaned) })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value: JSON.stringify(cleaned) } });
  res.json({ value: cleaned });
});

router.get("/settings/groups", requireAuth, async (_req, res): Promise<void> => {
  const value = await getSetting("groups", DEFAULT_GROUPS);
  res.json({ value });
});

router.put("/settings/groups", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { value } = req.body ?? {};
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) {
    res.status(400).json({ message: "Valore non valido: deve essere un array di stringhe" });
    return;
  }
  const cleaned = value.map((v: string) => v.trim()).filter(Boolean);
  await db
    .insert(settingsTable)
    .values({ key: "groups", value: JSON.stringify(cleaned) })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value: JSON.stringify(cleaned) } });
  res.json({ value: cleaned });
});

export default router;
