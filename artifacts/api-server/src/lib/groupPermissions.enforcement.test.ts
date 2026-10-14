import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb, rows } = vi.hoisted(() => ({
  mockDb: { select: vi.fn() },
  rows: [] as unknown[][],
}));

vi.mock("drizzle-orm", () => ({
  eq: (...args: unknown[]) => ({ eq: args }),
  and: (...args: unknown[]) => ({ and: args }),
}));

vi.mock("@workspace/db", () => ({
  db: mockDb,
  groupMembersTable: { userId: "member_user_id", groupId: "member_group_id" },
  groupsTable: { id: "group_id", organizationId: "group_org_id", permissions: "group_permissions" },
  usersTable: { id: "user_id", organizationId: "user_org_id", permissionOverrides: "overrides" },
}));

import { hasGroupPermission } from "./groupPermissions";

describe("hasGroupPermission enforcement", () => {
  beforeEach(() => {
    rows.length = 0;
    mockDb.select.mockReset();
    mockDb.select.mockImplementation(() => {
      const result = rows.shift() ?? [];
      const query: any = {
        from: () => query,
        innerJoin: () => query,
        where: () => Promise.resolve(result),
      };
      return query;
    });
  });

  it("rejects a group-granted permission when an individual denial is stored", async () => {
    rows.push(
      [{ permissions: '["add_notes"]' }],
      [{ permissionOverrides: '{"add_notes":"deny"}' }],
    );
    await expect(hasGroupPermission(42, 7, "add_notes", false)).resolves.toBe(false);
  });

  it("allows an individual grant even when no group grants the permission", async () => {
    rows.push(
      [],
      [{ permissionOverrides: '{"create_appointments":"grant"}' }],
    );
    await expect(hasGroupPermission(42, 7, "create_appointments", false)).resolves.toBe(true);
  });

  it("preserves the administrator role bypass without querying group membership", async () => {
    await expect(hasGroupPermission(42, 7, "add_notes", true)).resolves.toBe(true);
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it("reuses one summary within a request and reads fresh overrides on the next request", async () => {
    const firstRequest = {};
    rows.push(
      [{ permissions: '["add_notes","create_appointments"]' }],
      [{ permissionOverrides: "{}" }],
      [],
      [{ permissionOverrides: '{"add_notes":"deny"}' }],
      [],
      [{ permissionOverrides: '{"add_notes":"deny"}' }],
    );

    await expect(hasGroupPermission(42, 7, "add_notes", false, firstRequest)).resolves.toBe(true);
    await expect(hasGroupPermission(42, 7, "create_appointments", false, firstRequest)).resolves.toBe(true);
    expect(mockDb.select).toHaveBeenCalledTimes(2);

    await expect(hasGroupPermission(42, 8, "add_notes", false, firstRequest)).resolves.toBe(false);
    expect(mockDb.select).toHaveBeenCalledTimes(4);

    await expect(hasGroupPermission(42, 7, "add_notes", false, {})).resolves.toBe(false);
    expect(mockDb.select).toHaveBeenCalledTimes(6);
  });
});
