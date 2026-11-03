import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const organizationsTable = {
    id: { name: "organizations.id" },
    name: { name: "organizations.name" },
    isSharedWorkspace: { name: "organizations.isSharedWorkspace" },
    externalSharingEnabled: { name: "organizations.externalSharingEnabled" },
    billingOwnerOrganizationId: { name: "organizations.billingOwnerOrganizationId" },
  };
  const workspaceMembershipsTable = {
    workspaceOrganizationId: { name: "workspaceMemberships.workspaceOrganizationId" },
    userId: { name: "workspaceMemberships.userId" },
    role: { name: "workspaceMemberships.role" },
  };
  const usersTable = {
    organizationId: { name: "users.organizationId" },
  };
  return { db: { select: vi.fn() }, organizationsTable, workspaceMembershipsTable, usersTable };
});

vi.mock("@workspace/db", () => ({
  db: mocks.db,
  organizationsTable: mocks.organizationsTable,
  workspaceMembershipsTable: mocks.workspaceMembershipsTable,
  usersTable: mocks.usersTable,
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...values: unknown[]) => values),
  eq: vi.fn((left: unknown, right: unknown) => [left, right]),
}));

import { resolveWorkspaceUser } from "./workspaceContext";

function queueSelectResults(results: unknown[]) {
  let index = 0;
  mocks.db.select.mockImplementation(() => {
    const result = results[index++];
    const query: any = {
      from: vi.fn(() => query),
      innerJoin: vi.fn(() => query),
      where: vi.fn(() => Promise.resolve(result)),
    };
    return query;
  });
}

describe("resolveWorkspaceUser", () => {
  beforeEach(() => vi.resetAllMocks());

  it("keeps home billing ownership while applying the shared workspace role and members", async () => {
    queueSelectResults([
      [{ id: 10, name: "Acme", isSharedWorkspace: false, externalSharingEnabled: false, billingOwnerOrganizationId: null }],
      [{ id: 20, name: "Joint project", role: "admin", isSharedWorkspace: true, externalSharingEnabled: true, billingOwnerOrganizationId: 10 }],
      [{ id: 1, role: "admin" }, { id: 2, role: "user" }],
    ]);

    const user = await resolveWorkspaceUser({
      id: 1,
      organizationId: 10,
      role: "user",
      isSuperAdmin: false,
    } as any, 20);

    expect(user).toMatchObject({
      organizationId: 20,
      billingOrganizationId: 10,
      role: "admin",
      activeWorkspaceId: 20,
      isSharedWorkspace: true,
      externalSharingEnabled: true,
      workspaceMemberIds: [1, 2],
      workspaceAdminMemberIds: [1],
    });
  });

  it("rejects a workspace the account does not belong to", async () => {
    queueSelectResults([
      [{ id: 10, name: "Acme", isSharedWorkspace: false, externalSharingEnabled: false, billingOwnerOrganizationId: null }],
      [],
    ]);

    const user = await resolveWorkspaceUser({
      id: 1,
      organizationId: 10,
      role: "admin",
      isSuperAdmin: false,
    } as any, 99);

    expect(user).toBeNull();
  });
});
