import express from "express";
import cookieParser from "cookie-parser";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
  },
  createSession: vi.fn(),
  getCurrentUserId: vi.fn(),
}));

vi.mock("@workspace/db", () => {
  const usersTable = { email: {}, id: {}, isSuperAdmin: {}, isActive: {} };
  const organizationsTable = { id: {}, name: {} };
  const groupMembersTable = { groupId: {}, userId: {} };
  const groupsTable = { id: {}, permissions: {}, organizationId: {} };
  return {
    db: mocks.db,
    usersTable,
    organizationsTable,
    groupMembersTable,
    groupsTable,
    settingsTable: {},
  };
});

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
  sql: vi.fn(() => ({})),
}));

vi.mock("../lib/session", () => ({
  SESSION_COOKIE_MAX_AGE: 30 * 24 * 60 * 60,
  createSession: mocks.createSession,
  getCurrentUserId: mocks.getCurrentUserId,
  getSessionId: (req: { headers: { cookie?: string } }) => {
    const match = req.headers.cookie?.match(/(?:^|;\s*)session_id=([^;]+)/);
    return match?.[1];
  },
  destroySession: vi.fn(),
}));

vi.mock("./settings", () => ({
  STANDARD_CATEGORIES: [],
  DEFAULT_LOCATIONS: [],
}));

const originalNodeEnv = process.env.NODE_ENV;
const originalGoogleClientId = process.env.GOOGLE_CLIENT_ID;
const originalGoogleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const originalGlobalFetch = globalThis.fetch;
process.env.NODE_ENV = "production";
process.env.GOOGLE_CLIENT_ID = "oauth-test-client";
process.env.GOOGLE_CLIENT_SECRET = "oauth-test-secret";

const oauthUser = {
  id: 41,
  name: "OAuth Test User",
  email: "oauth-test@example.test",
  isActive: true,
  organizationId: 7,
  role: "admin",
  isSuperAdmin: false,
  lastLoginAt: new Date(),
};

const authMeUser = {
  ...oauthUser,
  organizationName: "OAuth Test Organization",
  isAvailable: true,
  phone: null,
  avatarUrl: null,
  createdAt: new Date(),
  onboardingDone: true,
  businessType: null,
  clientsEnabled: false,
  trialEndsAt: null,
  stripeSubscriptionId: null,
  tourDone: true,
  registeredViaInvite: false,
  entitySingular: "ticket",
  entityPlural: "tickets",
};

describe("Google OAuth callback", () => {
  let server: Server;
  let baseUrl: string;
  let restoreFetch: (() => void) | undefined;

  beforeAll(async () => {
    const [{ default: oauthRouter }, { default: authRouter }] = await Promise.all([
      import("./oauth"),
      import("./auth"),
    ]);
    const app = express();
    app.use(cookieParser());
    app.use("/api", oauthRouter);
    app.use("/api", authRouter);
    server = createServer(app);
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = originalGlobalFetch;
    mocks.createSession.mockResolvedValue("test-session-id");
    mocks.getCurrentUserId.mockImplementation((req: { headers: { cookie?: string } }) =>
      req.headers.cookie?.includes("session_id=test-session-id") ? oauthUser.id : undefined,
    );
    mocks.db.select.mockImplementation(() => {
      let table: unknown;
      let hasLeftJoin = false;
      const query: Record<string, ReturnType<typeof vi.fn>> = {};
      query.from = vi.fn((value: unknown) => {
        table = value;
        return query;
      });
      query.leftJoin = vi.fn(() => {
        hasLeftJoin = true;
        return query;
      });
      query.innerJoin = vi.fn(() => query);
      query.where = vi.fn(async () => {
        if (table === (await import("@workspace/db")).usersTable) {
          return [hasLeftJoin ? authMeUser : oauthUser];
        }
        return [];
      });
      return query;
    });
    mocks.db.update.mockImplementation(() => {
      const query: Record<string, ReturnType<typeof vi.fn>> = {};
      query.set = vi.fn(() => query);
      query.where = vi.fn(async () => undefined);
      return query;
    });
    mocks.db.insert.mockImplementation(() => {
      const query: Record<string, ReturnType<typeof vi.fn>> = {};
      query.values = vi.fn(() => query);
      query.returning = vi.fn(async () => []);
      return query;
    });
    vi.stubEnv("REPLIT_DOMAINS", "taskdesk.example.test");
    restoreFetch = () => {
      globalThis.fetch = originalGlobalFetch;
    };
  });

  afterAll(async () => {
    restoreFetch?.();
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalGoogleClientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = originalGoogleClientId;
    if (originalGoogleClientSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
    else process.env.GOOGLE_CLIENT_SECRET = originalGoogleClientSecret;
    vi.unstubAllEnvs();
  });

  async function startOAuth(): Promise<{ state: string; nonceCookie: string }> {
    const response = await fetch(`${baseUrl}/api/auth/google`);
    expect(response.status).toBe(200);
    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toContain("oauth_nonce=");
    const state = setCookie?.match(/oauth_nonce=([^;]+)/)?.[1];
    expect(state).toBeTruthy();
    return {
      state: state!,
      nonceCookie: `oauth_nonce=${state}`,
    };
  }

  async function callback(
    state: string,
    nonceCookie: string,
    extraParams: Record<string, string> = {},
  ): Promise<Response> {
    const params = new URLSearchParams({ code: "test-code", state, ...extraParams });
    return fetch(`${baseUrl}/api/auth/google/callback?${params}`, {
      headers: { Cookie: nonceCookie },
      redirect: "manual",
    });
  }

  function mockGoogleSuccess(): void {
    const googleResponses = [
      new Response(JSON.stringify({ access_token: "test-access-token" }), { status: 200 }),
      new Response(JSON.stringify({
        email: oauthUser.email,
        name: oauthUser.name,
      }), { status: 200 }),
    ];
    globalThis.fetch = vi.fn(async (input: string | URL, init?: RequestInit) => {
      if (String(input).startsWith(baseUrl)) return originalGlobalFetch(input, init);
      const response = googleResponses.shift();
      if (!response) throw new Error("Unexpected Google OAuth request");
      return response;
    });
  }

  it("delivers the secure session cookie on HTTP 200 and authenticates through /api/auth/me", async () => {
    const { state, nonceCookie } = await startOAuth();
    mockGoogleSuccess();

    const response = await callback(state, nonceCookie);
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(await response.text()).toContain('window.location.replace("/app/")');

    const setCookies = response.headers.getSetCookie();
    expect(setCookies).toHaveLength(2);
    expect(setCookies[0]).toContain("oauth_nonce=;");
    expect(setCookies[0]).toContain("Max-Age=0");
    expect(setCookies[1]).toContain("session_id=test-session-id");
    expect(setCookies[1]).toContain("Path=/");
    expect(setCookies[1]).toContain("HttpOnly");
    expect(setCookies[1]).toContain("SameSite=Lax");
    expect(setCookies[1]).toContain("Secure");
    expect(setCookies[1]).toContain("Max-Age=2592000");

    const meResponse = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: "session_id=test-session-id" },
    });
    expect(meResponse.status).toBe(200);
    expect(await meResponse.json()).toMatchObject({
      id: oauthUser.id,
      email: oauthUser.email,
      organizationName: authMeUser.organizationName,
      groupPermissions: [],
    });
  });

  it("rejects a callback with a nonce that does not match the pending state", async () => {
    const { state } = await startOAuth();

    const response = await callback(state, "oauth_nonce=wrong-state");

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/app/?oauth_error=invalid_state");
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it("rejects an expired state", async () => {
    const now = vi.spyOn(Date, "now");
    now.mockReturnValue(1_000);
    const { state, nonceCookie } = await startOAuth();
    now.mockReturnValue(1_000 + 10 * 60 * 1000 + 1);

    const response = await callback(state, nonceCookie);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/app/?oauth_error=invalid_state");
    expect(mocks.createSession).not.toHaveBeenCalled();
    now.mockRestore();
  });

  it("rejects reuse of a state after a successful callback", async () => {
    const { state, nonceCookie } = await startOAuth();
    mockGoogleSuccess();
    const firstResponse = await callback(state, nonceCookie);
    expect(firstResponse.status).toBe(200);

    const secondResponse = await callback(state, nonceCookie);

    expect(secondResponse.status).toBe(302);
    expect(secondResponse.headers.get("location")).toBe("/app/?oauth_error=invalid_state");
    expect(mocks.createSession).toHaveBeenCalledTimes(1);
  });

  it("retains the cancellation and token-exchange error responses", async () => {
    const cancelled = await fetch(
      `${baseUrl}/api/auth/google/callback?error=access_denied`,
      { redirect: "manual" },
    );
    expect(cancelled.status).toBe(302);
    expect(cancelled.headers.get("location")).toBe("/app/?oauth_error=cancelled");

    const { state, nonceCookie } = await startOAuth();
    globalThis.fetch = vi.fn(async (input: string | URL, init?: RequestInit) => {
      if (String(input).startsWith(baseUrl)) return originalGlobalFetch(input, init);
      return new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 });
    });
    const tokenFailure = await callback(state, nonceCookie);
    expect(tokenFailure.status).toBe(302);
    expect(tokenFailure.headers.get("location")).toBe("/app/?oauth_error=token_exchange");
  });
});