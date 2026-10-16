import express from "express";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: { select: vi.fn(), insert: vi.fn() },
  createSession: vi.fn(),
  attachReferralAtSignup: vi.fn(),
  getUserPermissionSummary: vi.fn(),
  inserted: [] as Array<{ table: unknown; values: Record<string, unknown> }>,
}));

vi.mock("@workspace/db", () => {
  const usersTable = { id: {}, email: {}, isSuperAdmin: {}, isActive: {} };
  const organizationsTable = { id: {}, name: {} };
  const settingsTable = {};
  return {
    db: mocks.db,
    usersTable,
    organizationsTable,
    settingsTable,
    groupMembersTable: {},
    groupsTable: {},
  };
});

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
  sql: vi.fn(() => ({})),
}));

vi.mock("../lib/session", () => ({
  SESSION_COOKIE_MAX_AGE: 2_592_000,
  createSession: mocks.createSession,
  destroySession: vi.fn(),
  getSessionId: vi.fn(),
  getCurrentUserId: vi.fn(),
}));

vi.mock("../lib/rateLimiter", () => ({
  loginRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  registerRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../lib/email", () => ({
  sendEmail: vi.fn(),
  buildRegistrationNotificationEmail: vi.fn(() => ({ subject: "", html: "", text: "" })),
}));

vi.mock("../lib/groupPermissions", () => ({
  getUserPermissionSummary: mocks.getUserPermissionSummary,
}));

vi.mock("../referralService", () => ({
  attachReferralAtSignup: mocks.attachReferralAtSignup,
}));

vi.mock("./settings", () => ({
  STANDARD_CATEGORIES: [],
  DEFAULT_LOCATIONS: [],
}));

describe("password signup referral attribution", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const { default: authRouter } = await import("./auth");
    const app = express();
    app.use(express.json());
    app.use("/api", authRouter);
    server = createServer(app);
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.inserted = [];
    mocks.createSession.mockResolvedValue("new-session");
    mocks.attachReferralAtSignup.mockResolvedValue(true);
    mocks.getUserPermissionSummary.mockResolvedValue({ effectivePermissions: [] });

    const { usersTable, organizationsTable } = await import("@workspace/db");
    mocks.db.select.mockImplementation(() => {
      const query: Record<string, ReturnType<typeof vi.fn>> = {};
      query.from = vi.fn(() => query);
      query.where = vi.fn(async () => []);
      return query;
    });
    mocks.db.insert.mockImplementation((table: unknown) => {
      const query: Record<string, ReturnType<typeof vi.fn>> = {};
      let values: Record<string, unknown> = {};
      query.values = vi.fn((input: Record<string, unknown>) => {
        values = input;
        return query;
      });
      query.returning = vi.fn(async () => {
        mocks.inserted.push({ table, values });
        if (table === organizationsTable) return [{ id: 91, name: values.name }];
        if (table === usersTable) {
          return [{
            id: 92,
            name: values.name,
            email: values.email,
            role: values.role,
            organizationId: values.organizationId,
            isActive: true,
            passwordHash: values.passwordHash,
          }];
        }
        return [];
      });
      query.onConflictDoNothing = vi.fn(() => query);
      return query;
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }
  });

  it("passes the referral code to attribution and keeps all UTM values on the new organization", async () => {
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "New Admin",
        email: "New.Admin@Example.test",
        password: "password123",
        organizationName: " New Organization ",
        referralCode: "ReferralCode_123",
        utmSource: "partner",
        utmMedium: "email",
        utmCampaign: "autumn",
      }),
    });

    expect(response.status).toBe(201);
    const { organizationsTable } = await import("@workspace/db");
    const orgInsert = mocks.inserted.find((entry) => entry.table === organizationsTable);
    expect(orgInsert?.values).toMatchObject({
      name: "New Organization",
      utmSource: "partner",
      utmMedium: "email",
      utmCampaign: "autumn",
    });
    expect(mocks.attachReferralAtSignup).toHaveBeenCalledWith(
      "ReferralCode_123",
      91,
      "new.admin@example.test",
    );
  });
});
