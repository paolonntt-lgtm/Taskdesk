import { eq, and } from "drizzle-orm";
import { db, groupMembersTable, groupsTable, usersTable } from "@workspace/db";

export const VIEW_WORKED_HOURS_PERMISSION = "view_worked_hours";
export const ASSIGN_TIME_TRACKED_TICKETS_PERMISSION = "assign_time_tracked_tickets";
export const GROUP_PERMISSION_KEYS = [
  "change_status",
  ASSIGN_TIME_TRACKED_TICKETS_PERMISSION,
  "add_notes",
  "edit_fixed_notes",
  "edit_client_notes",
  "delete_client_notes",
  "manage_client_sections",
  "edit_client_section_content",
  "create_appointments",
  VIEW_WORKED_HOURS_PERMISSION,
] as const;

export type GroupPermission = typeof GROUP_PERMISSION_KEYS[number];
export type PermissionOverride = "inherit" | "grant" | "deny";
export type PermissionOverrides = Partial<Record<GroupPermission, PermissionOverride>>;
type PermissionSummary = Awaited<ReturnType<typeof getUserPermissionSummary>>;

const requestPermissionSummaries = new WeakMap<object, Map<string, Promise<PermissionSummary>>>();

export function parsePermissionOverrides(raw: string | null | undefined): PermissionOverrides {
  try {
    const parsed: unknown = JSON.parse(raw ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const result: PermissionOverrides = {};
    for (const key of GROUP_PERMISSION_KEYS) {
      const value = (parsed as Record<string, unknown>)[key];
      if (value === "inherit" || value === "grant" || value === "deny") {
        result[key] = value;
      }
    }
    return result;
  } catch {
    return {};
  }
}

export function resolvePermissionSummary(
  role: string,
  inheritedPermissions: string[],
  overrides: PermissionOverrides,
) {
  const inherited = GROUP_PERMISSION_KEYS.filter((key) => inheritedPermissions.includes(key));
  const effectivePermissions = GROUP_PERMISSION_KEYS.filter((key) => {
    if (role === "admin") return true;
    const override = overrides[key] ?? "inherit";
    return override === "grant" || (override === "inherit" && inherited.includes(key));
  });
  return { inheritedGroupPermissions: inherited, effectivePermissions };
}

export async function getUserPermissionSummary(userId: number, organizationId: number | null, role: string) {
  const memberships = organizationId == null
    ? []
    : await db
        .select({ permissions: groupsTable.permissions })
        .from(groupMembersTable)
        .innerJoin(groupsTable, eq(groupMembersTable.groupId, groupsTable.id))
        .where(and(
          eq(groupMembersTable.userId, userId),
          eq(groupsTable.organizationId, organizationId),
        ));
  const [user] = await db
    .select({ permissionOverrides: usersTable.permissionOverrides })
    .from(usersTable)
    .where(and(
      eq(usersTable.id, userId),
      organizationId == null ? undefined : eq(usersTable.organizationId, organizationId),
    ));
  const inherited = [...new Set(memberships.flatMap((membership) => {
    try {
      const parsed: unknown = JSON.parse(membership.permissions ?? "[]");
      return Array.isArray(parsed) ? parsed.filter((permission): permission is string => typeof permission === "string") : [];
    } catch {
      return [];
    }
  }))];
  const overrides = parsePermissionOverrides(user?.permissionOverrides);
  const { inheritedGroupPermissions, effectivePermissions } =
    resolvePermissionSummary(role, inherited, overrides);
  return {
    groupPermissions: effectivePermissions,
    inheritedGroupPermissions,
    effectivePermissions,
    permissionOverrides: overrides,
  };
}

export async function hasGroupPermission(
  userId: number,
  organizationId: number | null,
  permission: string,
  isAdmin: boolean,
  requestContext?: object,
): Promise<boolean> {
  if (isAdmin) return true;
  if (!GROUP_PERMISSION_KEYS.includes(permission as GroupPermission)) return false;
  let summaryPromise: Promise<PermissionSummary>;
  if (requestContext) {
    let requestCache = requestPermissionSummaries.get(requestContext);
    if (!requestCache) {
      requestCache = new Map();
      requestPermissionSummaries.set(requestContext, requestCache);
    }
    const key = `${userId}:${organizationId ?? "none"}`;
    summaryPromise = requestCache.get(key) ?? getUserPermissionSummary(userId, organizationId, "user");
    if (!requestCache.has(key)) requestCache.set(key, summaryPromise);
  } else {
    summaryPromise = getUserPermissionSummary(userId, organizationId, "user");
  }
  const summary = await summaryPromise;
  return summary.effectivePermissions.includes(permission as GroupPermission);
}
