import { Router, type IRouter } from "express";
import { eq, inArray, and, isNull } from "drizzle-orm";
import { db, ticketActivityLogsTable, ticketsTable, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/tickets/:id/activity", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;

  const [ticket] = await db.select({ id: ticketsTable.id, visibility: ticketsTable.visibility }).from(ticketsTable).where(
    and(eq(ticketsTable.id, id), isNull(ticketsTable.deletedAt), orgId != null ? eq(ticketsTable.organizationId, orgId) : undefined)
  );
  if (!ticket || (currentUser.role !== "admin" && ticket.visibility === "admins")) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

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
