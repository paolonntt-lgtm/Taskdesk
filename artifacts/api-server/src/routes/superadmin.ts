import { Router, type IRouter } from "express";
import { db, usersTable, organizationsTable, ticketsTable } from "@workspace/db";
import { eq, desc, and, sql, notInArray } from "drizzle-orm";
import { requireAuth, requireSuperAdmin } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/superadmin", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const [rows, ticketCounts] = await Promise.all([
    db
      .select({
        orgId: organizationsTable.id,
        orgName: organizationsTable.name,
        orgCreatedAt: organizationsTable.createdAt,
        userId: usersTable.id,
        userName: usersTable.name,
        userEmail: usersTable.email,
        userRole: usersTable.role,
        userIsActive: usersTable.isActive,
        userCreatedAt: usersTable.createdAt,
        lastLoginAt: usersTable.lastLoginAt,
        avatarUrl: usersTable.avatarUrl,
      })
      .from(organizationsTable)
      .leftJoin(
        usersTable,
        and(
          eq(usersTable.organizationId, organizationsTable.id),
          eq(usersTable.isActive, true),
        )
      )
      .orderBy(desc(organizationsTable.createdAt), desc(usersTable.createdAt)),

    db
      .select({
        organizationId: ticketsTable.organizationId,
        totalCount: sql<number>`count(*)::int`,
      })
      .from(ticketsTable)
      .groupBy(ticketsTable.organizationId),
  ]);

  const totalByOrg = new Map<number, number>();
  for (const row of ticketCounts) {
    if (row.organizationId != null) totalByOrg.set(row.organizationId, row.totalCount);
  }

  const orgMap = new Map<number, {
    id: number;
    name: string;
    createdAt: string | null;
    totalTickets: number;
    users: Array<{
      id: number;
      name: string;
      email: string;
      role: string;
      createdAt: string | null;
      lastLoginAt: string | null;
      avatarUrl: string | null;
    }>;
  }>();

  for (const row of rows) {
    if (!orgMap.has(row.orgId)) {
      orgMap.set(row.orgId, {
        id: row.orgId,
        name: row.orgName,
        createdAt: row.orgCreatedAt?.toISOString() ?? null,
        totalTickets: totalByOrg.get(row.orgId) ?? 0,
        users: [],
      });
    }
    if (row.userId && row.userIsActive) {
      orgMap.get(row.orgId)!.users.push({
        id: row.userId,
        name: row.userName!,
        email: row.userEmail!,
        role: row.userRole!,
        createdAt: row.userCreatedAt?.toISOString() ?? null,
        lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
        avatarUrl: row.avatarUrl ?? null,
      });
    }
  }

  res.json({ organizations: Array.from(orgMap.values()) });
});

export default router;
