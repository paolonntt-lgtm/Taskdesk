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
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string" || !v.trim())) {
    res.status(400).json({ message: "Valore non valido: deve essere un array di stringhe non vuote" });
    return;
  }
  const cleaned = value.map((v: string) => v.trim()).filter(Boolean);
  if (cleaned.length === 0) {
    res.status(400).json({ message: "La lista non può essere vuota" });
    return;
  }
  await db
    .insert(settingsTable)
    .values({ key: "locations", value: JSON.stringify(cleaned) })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value: JSON.stringify(cleaned) } });
  res.json({ value: cleaned });
});

router.put("/settings/categories", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { value } = req.body ?? {};
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string" || !v.trim())) {
    res.status(400).json({ message: "Valore non valido: deve essere un array di stringhe non vuote" });
    return;
  }
  const cleaned = value.map((v: string) => v.trim()).filter(Boolean);
  if (cleaned.length === 0) {
    res.status(400).json({ message: "La lista non può essere vuota" });
    return;
  }
  await db
    .insert(settingsTable)
    .values({ key: "categories", value: JSON.stringify(cleaned) })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value: JSON.stringify(cleaned) } });
  res.json({ value: cleaned });
});

export default router;
