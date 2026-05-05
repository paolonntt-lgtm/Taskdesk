import { Router, type IRouter } from "express";
import { db, usersTable, organizationsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { requireSuperAdmin } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/superadmin/subscribers", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const orgs = await db
    .select({
      orgId: organizationsTable.id,
      orgName: organizationsTable.name,
      createdAt: organizationsTable.createdAt,
      userId: usersTable.id,
      userName: usersTable.name,
      userEmail: usersTable.email,
      userRole: usersTable.role,
      userIsActive: usersTable.isActive,
      userCreatedAt: usersTable.createdAt,
      avatarUrl: usersTable.avatarUrl,
    })
    .from(organizationsTable)
    .leftJoin(usersTable, eq(usersTable.organizationId, organizationsTable.id))
    .orderBy(desc(organizationsTable.createdAt), desc(usersTable.createdAt));

  // Group by organization
  const orgMap = new Map<number, {
    id: number;
    name: string;
    createdAt: string | null;
    users: Array<{
      id: number;
      name: string;
      email: string;
      role: string;
      isActive: boolean;
      createdAt: string | null;
      avatarUrl: string | null;
    }>;
  }>();

  for (const row of orgs) {
    if (!orgMap.has(row.orgId)) {
      orgMap.set(row.orgId, {
        id: row.orgId,
        name: row.orgName,
        createdAt: row.createdAt?.toISOString() ?? null,
        users: [],
      });
    }
    if (row.userId) {
      orgMap.get(row.orgId)!.users.push({
        id: row.userId,
        name: row.userName!,
        email: row.userEmail!,
        role: row.userRole!,
        isActive: row.userIsActive!,
        createdAt: row.userCreatedAt?.toISOString() ?? null,
        avatarUrl: row.avatarUrl ?? null,
      });
    }
  }

  res.json({ organizations: Array.from(orgMap.values()) });
});

export default router;
