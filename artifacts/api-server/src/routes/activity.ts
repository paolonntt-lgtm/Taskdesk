import { Router, type IRouter } from "express";
import { eq, inArray } from "drizzle-orm";
import { db, ticketActivityLogsTable, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/tickets/:id/activity", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const logs = await db
    .select()
    .from(ticketActivityLogsTable)
    .where(eq(ticketActivityLogsTable.ticketId, id))
    .orderBy(ticketActivityLogsTable.createdAt);

  const userIds = [...new Set(logs.map((l) => l.userId))];
  const usersResult = userIds.length > 0
    ? await db
        .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, role: usersTable.role, mainLocation: usersTable.mainLocation, createdAt: usersTable.createdAt })
        .from(usersTable)
        .where(inArray(usersTable.id, userIds))
    : [];
  const userMap = new Map(usersResult.map((u) => [u.id, u]));

  res.json(logs.map((l) => ({ ...l, user: userMap.get(l.userId)! })));
});

export default router;
