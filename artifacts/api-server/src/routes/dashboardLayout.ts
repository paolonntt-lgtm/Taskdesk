import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, settingsTable, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/dashboard-layout", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).currentUser;
  const featureKey = `org_${user.organizationId}_auto_collaborator_dashboard_widgets`;
  const [[row], [feature]] = await Promise.all([
    db
      .select({ dashboardLayout: usersTable.dashboardLayout })
      .from(usersTable)
      .where(eq(usersTable.id, user.id)),
    db
      .select({ value: settingsTable.value })
      .from(settingsTable)
      .where(eq(settingsTable.key, featureKey)),
  ]);
  const autoCollaboratorWidgets = feature?.value === "true";

  if (!row || !row.dashboardLayout) {
    res.json({ layout: null, visibleIds: null, autoCollaboratorWidgets });
    return;
  }

  try {
    const parsed = JSON.parse(row.dashboardLayout);
    res.json({
      layout: parsed.layout ?? null,
      visibleIds: parsed.visibleIds ?? null,
      autoCollaboratorWidgets,
    });
  } catch {
    res.json({ layout: null, visibleIds: null, autoCollaboratorWidgets });
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
