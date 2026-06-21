import { eq, and } from "drizzle-orm";
import { db, groupMembersTable, groupsTable } from "@workspace/db";

export async function hasGroupPermission(
  userId: number,
  organizationId: number | null,
  permission: string,
  isAdmin: boolean,
): Promise<boolean> {
  if (isAdmin) return true;
  if (organizationId == null) return false;

  const memberships = await db
    .select({ permissions: groupsTable.permissions })
    .from(groupMembersTable)
    .innerJoin(groupsTable, eq(groupMembersTable.groupId, groupsTable.id))
    .where(
      and(
        eq(groupMembersTable.userId, userId),
        eq(groupsTable.organizationId, organizationId),
      )
    );

  return memberships.some((m) => {
    try {
      const perms: string[] = JSON.parse(m.permissions ?? "[]");
      return perms.includes(permission);
    } catch {
      return false;
    }
  });
}
