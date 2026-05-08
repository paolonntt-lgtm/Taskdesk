import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import {
  db,
  notificationPreferencesTable,
  NOTIFICATION_TYPES,
  type NotificationType,
} from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

interface PrefRow {
  type: NotificationType;
  inApp: boolean;
  browser: boolean;
  sound: boolean;
  email: boolean;
}

function defaults(): PrefRow[] {
  return NOTIFICATION_TYPES.map((type) => ({
    type,
    inApp: true,
    browser: true,
    sound: true,
    email: false,
  }));
}

router.get("/notification-preferences", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).currentUser;
  const rows = await db
    .select()
    .from(notificationPreferencesTable)
    .where(eq(notificationPreferencesTable.userId, user.id));

  const map = new Map<string, PrefRow>();
  for (const r of rows) {
    map.set(r.type, {
      type: r.type as NotificationType,
      inApp: r.inApp,
      browser: r.browser,
      sound: r.sound,
      email: r.email,
    });
  }
  const merged = defaults().map((d) => map.get(d.type) ?? d);
  res.json({ preferences: merged });
});

router.put("/notification-preferences", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).currentUser;
  const body = req.body;
  if (!body || !Array.isArray(body.preferences)) {
    res.status(400).json({ error: "Invalid request: preferences array required" });
    return;
  }

  const updates: PrefRow[] = [];
  for (const p of body.preferences) {
    if (!p || typeof p.type !== "string") continue;
    if (!(NOTIFICATION_TYPES as readonly string[]).includes(p.type)) continue;
    updates.push({
      type: p.type as NotificationType,
      inApp: p.inApp !== false,
      browser: p.browser !== false,
      sound: p.sound !== false,
      email: p.email !== false,
    });
  }

  if (updates.length > 0) {
    await db
      .insert(notificationPreferencesTable)
      .values(
        updates.map((u) => ({
          userId: user.id,
          type: u.type,
          inApp: u.inApp,
          browser: u.browser,
          sound: u.sound,
          email: u.email,
        }))
      )
      .onConflictDoUpdate({
        target: [notificationPreferencesTable.userId, notificationPreferencesTable.type],
        set: {
          inApp: sql`EXCLUDED.in_app`,
          browser: sql`EXCLUDED.browser`,
          sound: sql`EXCLUDED.sound`,
          email: sql`EXCLUDED.email`,
          updatedAt: new Date(),
        },
      });
  }

  res.json({ success: true, preferences: updates });
});

export default router;
