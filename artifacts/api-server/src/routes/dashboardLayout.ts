import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/dashboard-layout", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).currentUser;
  const [row] = await db
    .select({ dashboardLayout: usersTable.dashboardLayout })
    .from(usersTable)
    .where(eq(usersTable.id, user.id));

  if (!row || !row.dashboardLayout) {
    res.json({ layout: null, visibleIds: null });
    return;
  }

  try {
    const parsed = JSON.parse(row.dashboardLayout);
    res.json({ layout: parsed.layout ?? null, visibleIds: parsed.visibleIds ?? null });
  } catch {
    res.json({ layout: null, visibleIds: null });
  }
});

router.put("/dashboard-layout", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).currentUser;
  const { layout, visibleIds } = req.body ?? {};

  if (!Array.isArray(layout) || !Array.isArray(visibleIds)) {
    res.status(400).json({ error: "layout and visibleIds arrays are required" });
    return;
  }

  const payload = JSON.stringify({ layout, visibleIds });
  await db
    .update(usersTable)
    .set({ dashboardLayout: payload })
    .where(eq(usersTable.id, user.id));

  res.json({ success: true });
});

export default router;
