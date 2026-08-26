import { Router, type IRouter } from "express";
import { ilike, or, eq, and } from "drizzle-orm";
import { db, ticketsTable, clientsTable, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { z } from "zod";

const router: IRouter = Router();

const SearchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(20).optional().default(5),
});

router.get("/search", requireAuth, async (req, res) => {
  const parsed = SearchQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query" });
    return;
  }

  const { q, limit } = parsed.data;
  const user = (req as any).currentUser;
  const orgId = user.organizationId;
  const pattern = `%${q}%`;

  const [tickets, clients, users] = await Promise.all([
    db
      .select({
        id: ticketsTable.id,
        ticketNumber: ticketsTable.ticketNumber,
        title: ticketsTable.title,
        status: ticketsTable.status,
        priority: ticketsTable.priority,
      })
      .from(ticketsTable)
      .where(
        and(
          eq(ticketsTable.organizationId, orgId),
          ilike(ticketsTable.title, pattern),
          user.role === "admin" ? undefined : eq(ticketsTable.visibility, "organization"),
        )
      )
      .limit(limit),

    (user as any).clientsEnabled !== false
      ? db
          .select({
            id: clientsTable.id,
            name: clientsTable.name,
            email: clientsTable.email,
          })
          .from(clientsTable)
          .where(
            and(
              eq(clientsTable.organizationId, orgId),
              or(
                ilike(clientsTable.name, pattern),
                ilike(clientsTable.alias ?? clientsTable.name, pattern)
              )
            )
          )
          .limit(limit)
      : Promise.resolve([]),

    user.role === "admin"
      ? db
          .select({
            id: usersTable.id,
            name: usersTable.name,
            email: usersTable.email,
            role: usersTable.role,
          })
          .from(usersTable)
          .where(
            and(
              eq(usersTable.organizationId, orgId),
              eq(usersTable.isActive, true),
              or(ilike(usersTable.name, pattern), ilike(usersTable.email, pattern))
            )
          )
          .limit(limit)
      : Promise.resolve([]),
  ]);

  res.json({
    tickets: tickets.map((t) => ({
      id: t.id,
      ticketNumber: t.ticketNumber,
      title: t.title,
      status: t.status,
      priority: t.priority,
    })),
    clients: clients.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email ?? null,
    })),
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
    })),
  });
});

export default router;
