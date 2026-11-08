import express from "express";
import cookieParser from "cookie-parser";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { FREE_TRIAL_DURATION_MS } from "../lib/trialStatus";

const mocks = vi.hoisted(() => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
  },
  createSession: vi.fn(),
  getCurrentUserId: vi.fn(),
  attachReferralAtSignup: vi.fn(),
}));

vi.mock("@workspace/db", () => {
  const usersTable = { email: {}, id: {}, isSuperAdmin: {}, isActive: {} };
  const organizationsTable = {
    id: {},
    name: {},
    isSharedWorkspace: {},
    billingOwnerOrganizationId: {},
  };
  const workspaceMembershipsTable = {
    id: {},
    userId: {},
    role: {},
    workspaceOrganizationId: {},
  };
  const groupMembersTable = { groupId: {}, userId: {} };
  const groupsTable = { id: {}, permissions: {}, organizationId: {} };
  return {
    db: mocks.db,
    usersTable,
    organizationsTable,
    workspaceMembershipsTable,
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

vi.mock("../referralService", () => ({
  attachReferralAtSignup: mocks.attachReferralAtSignup,
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
    mocks.attachReferralAtSignup.mockResolvedValue(true);
    mocks.getCurrentUserId.mockImplementation((req: { headers: { cookie?: string } }) =>
      req.headers.cookie?.includes("session_id=test-session-id") ? oauthUser.id : undefined,
    );
    mocks.db.select.mockImplementation((selection?: Record<string, unknown>) => {
      let table: unknown;
      let hasLeftJoin = false;
      const selectedFields = Object.keys(selection ?? {});
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
        const dbTables = await import("@workspace/db");
        if (table === dbTables.organizationsTable) {
          if (selectedFields.includes("onboardingDone")) {
            return [{
              onboardingDone: authMeUser.onboardingDone,
              businessType: authMeUser.businessType,
              clientsEnabled: authMeUser.clientsEnabled,
              entitySingular: authMeUser.entitySingular,
              entityPlural: authMeUser.entityPlural,
            }];
          }
          return [{
            id: oauthUser.organizationId,
            name: authMeUser.organizationName,
            isSharedWorkspace: false,
            billingOwnerOrganizationId: oauthUser.organizationId,
          }];
        }
        if (table === dbTables.workspaceMembershipsTable) {
          return [];
        }
        if (table === dbTables.usersTable) {
          if (!hasLeftJoin) return [oauthUser];
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

  async function startOAuth(query: Record<string, string> = {}): Promise<{ state: string; nonceCookie: string }> {
    const queryString = new URLSearchParams(query).toString();
    const response = await fetch(`${baseUrl}/api/auth/google${queryString ? `?${queryString}` : ""}`);
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

  async function callbackAt(
    callbackBaseUrl: string,
    state: string,
    nonceCookie: string,
    extraParams: Record<string, string> = {},
  ): Promise<Response> {
    const params = new URLSearchParams({ code: "test-code", state, ...extraParams });
    return fetch(`${callbackBaseUrl}/api/auth/google/callback?${params}`, {
      headers: { Cookie: nonceCookie },
      redirect: "manual",
    });
  }

  async function callback(
    state: string,
    nonceCookie: string,
    extraParams: Record<string, string> = {},
  ): Promise<Response> {
    return callbackAt(baseUrl, state, nonceCookie, extraParams);
  }

  function mockGoogleSuccess(additionalApiBaseUrls: string[] = []): void {
    const googleResponses = [
      new Response(JSON.stringify({ access_token: "test-access-token" }), { status: 200 }),
      new Response(JSON.stringify({
        email: oauthUser.email,
        name: oauthUser.name,
      }), { status: 200 }),
    ];
    globalThis.fetch = vi.fn(async (input: string | URL, init?: RequestInit) => {
      if ([baseUrl, ...additionalApiBaseUrls].some((apiBaseUrl) => String(input).startsWith(apiBaseUrl))) {
        return originalGlobalFetch(input, init);
      }
      const response = googleResponses.shift();
      if (!response) throw new Error("Unexpected Google OAuth request");
      return response;
    });
  }

  it("completes Google registration on a fresh router instance", async () => {
    const { state, nonceCookie } = await startOAuth({
      mode: "register",
      profession: "commercio",
      organizationName: "Studio Test",
      ref: "ReferralCode_123",
      utm_source: "instance-switch",
    });

    // A fresh module import creates a different Router, like a callback routed
    // to another autoscale instance with no process-local pending state.
    vi.resetModules();
    const { default: callbackRouter } = await import("./oauth");
    const { usersTable, organizationsTable } = await import("@workspace/db");
    const registeredOrganization = { id: 42, name: "Studio Test" };
    const registeredUser = {
      ...oauthUser,
      id: 42,
      email: oauthUser.email,
      organizationId: registeredOrganization.id,
    };
    mocks.db.select.mockImplementation(() => {
      const query: Record<string, ReturnType<typeof vi.fn>> = {};
      query.from = vi.fn(() => query);
      query.where = vi.fn(async () => []);
      return query;
    });
    const insertedValues: Array<{ table: unknown; values: Record<string, unknown> }> = [];
    mocks.db.insert.mockImplementation((table: unknown) => {
      const query: Record<string, ReturnType<typeof vi.fn>> = {};
      let values: Record<string, unknown> = {};
      query.values = vi.fn((input: Record<string, unknown>) => {
        values = input;
        return query;
      });
      query.returning = vi.fn(async () => {
        insertedValues.push({ table, values });
        return table === organizationsTable
          ? [registeredOrganization]
          : table === usersTable
            ? [registeredUser]
            : [];
      });
      return query;
    });
    const callbackApp = express();
    callbackApp.use(cookieParser());
    callbackApp.use("/api", callbackRouter);
    const callbackServer = createServer(callbackApp);
    await new Promise<void>((resolve, reject) => {
      callbackServer.once("error", reject);
      callbackServer.listen(0, "127.0.0.1", resolve);
    });
    const callbackBaseUrl = `http://127.0.0.1:${(callbackServer.address() as AddressInfo).port}`;

    try {
      mockGoogleSuccess([callbackBaseUrl]);
      const response = await callbackAt(callbackBaseUrl, state, nonceCookie);
      const html = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/html");
      expect(html).toContain('window.location.replace("/app/?ref=ReferralCode_123")');
      expect(mocks.db.insert).toHaveBeenCalledWith(organizationsTable);
      expect(mocks.db.insert).toHaveBeenCalledWith(usersTable);
      expect(mocks.createSession).toHaveBeenCalledWith(registeredUser.id);
      expect(mocks.attachReferralAtSignup).toHaveBeenCalledTimes(1);
      expect(mocks.attachReferralAtSignup).toHaveBeenCalledWith(
        "ReferralCode_123",
        registeredOrganization.id,
        registeredUser.email,
        true,
      );
      expect(response.headers.getSetCookie()).toContainEqual(
        expect.stringContaining("session_id=test-session-id"),
      );
      expect(insertedValues.find((entry) => entry.table === organizationsTable)?.values).toMatchObject({
        name: "Studio Test",
        profession: "commercio",
        utmSource: "instance-switch",
      });
    } finally {
      await new Promise<void>((resolve, reject) => {
        callbackServer.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it("delivers the secure session cookie on HTTP 200 and authenticates through /api/auth/me", async () => {
    const { state, nonceCookie } = await startOAuth({
      trial_profession: "commercialisti",
      trial_language: "it",
    });
    mockGoogleSuccess();

    const response = await callback(state, nonceCookie);
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(html).toContain('window.location.replace("/app/")');
    expect(html).not.toContain("oauth_trial_signup");

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
      groupPermissions: [
        "change_status",
        "assign_time_tracked_tickets",
        "add_notes",
        "edit_fixed_notes",
        "edit_client_notes",
        "delete_client_notes",
        "manage_client_sections",
        "edit_client_section_content",
        "create_appointments",
        "view_worked_hours",
      ],
    });
  });

  it("requires a profession before starting Google registration", async () => {
    const response = await fetch(`${baseUrl}/api/auth/google?mode=register`);
    expect(response.status).toBe(400);
  });

  it("requires an organization name before starting Google registration", async () => {
    const response = await fetch(`${baseUrl}/api/auth/google?mode=register&profession=commercio`);
    expect(response.status).toBe(400);
  });

  it("starts preview-host Google registration on the canonical callback host", async () => {
    const query = new URLSearchParams({
      mode: "register",
      profession: "commercio",
      organizationName: "Studio Example",
      ref: "ReferralCode_123",
    }).toString();
    const previewResponse = await fetch(`${baseUrl}/api/auth/google?${query}`, {
      headers: { "x-forwarded-host": "preview.example.test" },
      redirect: "manual",
    });

    expect(previewResponse.status).toBe(302);
    expect(previewResponse.headers.get("location"))
      .toBe(`https://taskdesk.example.test/api/auth/google?${query}`);
    expect(previewResponse.headers.get("set-cookie")).toBeNull();

    const canonicalResponse = await fetch(`${baseUrl}/api/auth/google?${query}`, {
      headers: { "x-forwarded-host": "taskdesk.example.test" },
      redirect: "manual",
    });
    expect(canonicalResponse.status).toBe(200);
    expect(canonicalResponse.headers.get("set-cookie")).toContain("oauth_nonce=");
    expect(await canonicalResponse.text())
      .toContain(encodeURIComponent("https://taskdesk.example.test/api/auth/google/callback"));
  });

  it("does not create a Google account from login when no profession was selected", async () => {
    mocks.db.select.mockImplementation(() => {
      const query: Record<string, ReturnType<typeof vi.fn>> = {};
      query.from = vi.fn(() => query);
      query.where = vi.fn(async () => []);
      return query;
    });
    const { state, nonceCookie } = await startOAuth();
    mockGoogleSuccess();

    const response = await callback(state, nonceCookie);
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/app/?mode=register&oauth_error=profession_required");
    expect(mocks.db.insert).not.toHaveBeenCalled();
  });

  it("does not apply or reveal a referral when an existing Google user signs in", async () => {
    const referralCode = "ReferralCode_123";
    const privateReferrerEmail = "referrer.private@example.test";
    const privateReferrerOrganization = "Private Referrer Organization";
    const { state, nonceCookie } = await startOAuth({ ref: referralCode });
    mockGoogleSuccess();

    const response = await callback(state, nonceCookie);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.getSetCookie()).toContainEqual(
      expect.stringContaining("session_id=test-session-id"),
    );
    expect(html).toContain('window.location.replace("/app/")');
    expect(html).not.toContain(referralCode);
    expect(html).not.toContain(privateReferrerEmail);
    expect(html).not.toContain(privateReferrerOrganization);
    expect(mocks.attachReferralAtSignup).not.toHaveBeenCalled();
  });

  it.each(
    ["notai", "commercio", "agenzie"].flatMap((profession) =>
      [true, false].map((applied) => ({ profession, applied })),
    ),
  )("starts a seven-day trial for $profession when referral application is $applied", async ({ profession, applied }) => {
    const privateReferrerEmail = "referrer.private@example.test";
    const privateReferrerOrganization = "Private Referrer Organization";
    mocks.attachReferralAtSignup.mockResolvedValue(applied);
    const { usersTable, organizationsTable } = await import("@workspace/db");
    const org = { id: 22, name: "OAuth New User" };
    const newUser = { ...oauthUser, id: 42, email: "new-google@example.test", trialEndsAt: null };
    let userLookupCount = 0;
    mocks.db.select.mockImplementation(() => {
      let table: unknown;
      const query: Record<string, ReturnType<typeof vi.fn>> = {};
      query.from = vi.fn((value: unknown) => { table = value; return query; });
      query.where = vi.fn(async () => {
        if (table === usersTable) {
          userLookupCount += 1;
          return userLookupCount === 1 ? [] : [];
        }
        return [];
      });
      return query;
    });
    const insertedValues: Array<{ table: unknown; values: Record<string, unknown> }> = [];
    mocks.db.insert.mockImplementation((table: unknown) => {
      const query: Record<string, ReturnType<typeof vi.fn>> = {};
      let values: Record<string, unknown> = {};
      query.values = vi.fn((input: Record<string, unknown>) => {
        values = input;
        return query;
      });
      query.returning = vi.fn(async () => {
        insertedValues.push({ table, values });
        return table === organizationsTable ? [org] : [{ ...newUser, ...values }];
      });
      return query;
    });
    const { state, nonceCookie } = await startOAuth({
      trial_profession: profession,
      trial_language: "en",
      ref: "ReferralCode_123",
      utm_source: "partner",
      utm_medium: "email",
      utm_campaign: "autumn",
      email: "must-not-be-carried@example.test",
      custom: "free text must not be carried",
    });
    mockGoogleSuccess();

    const response = await callback(state, nonceCookie);
    const html = await response.text();
    const insertedUser = insertedValues.find((entry) => entry.table === usersTable);
    const insertedOrganization = insertedValues.find((entry) => entry.table === organizationsTable);

    expect(response.status).toBe(200);
    expect(insertedUser?.values.trialEndsAt).toBeInstanceOf(Date);
    expect(insertedOrganization?.values).toMatchObject({
      profession,
      businessType: profession === "commercio" ? "other" : profession === "agenzie" ? "agency" : "professional_studio",
      utmSource: "partner",
      utmMedium: "email",
      utmCampaign: "autumn",
    });
    expect(mocks.attachReferralAtSignup).toHaveBeenCalledWith(
      "ReferralCode_123",
      org.id,
      oauthUser.email,
      true,
    );
    expect(html).not.toContain(privateReferrerEmail);
    expect(html).not.toContain(privateReferrerOrganization);
    const actualTrialDuration = (insertedUser?.values.trialEndsAt as Date).getTime() - Date.now();
    expect(actualTrialDuration).toBeGreaterThan(FREE_TRIAL_DURATION_MS - 1_000);
    expect(actualTrialDuration).toBeLessThanOrEqual(FREE_TRIAL_DURATION_MS);
    expect(html).toContain(`/app/?oauth_trial_signup=1&trial_profession=${profession}&trial_language=en`);
    expect(html).toContain("&ref=ReferralCode_123");
    expect(html).not.toContain("must-not-be-carried");
    expect(html).not.toContain("custom");
  });

  it("rejects a callback with a nonce that does not match the pending state", async () => {
    const { state } = await startOAuth();

    const response = await callback(state, "oauth_nonce=wrong-state");

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/app/?oauth_error=invalid_state");
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it("rejects a Google state whose signature was changed", async () => {
    const { state, nonceCookie } = await startOAuth();
    const [payload, signature] = state.split(".");
    const changedSignature = `${signature.slice(0, -1)}${signature.endsWith("A") ? "B" : "A"}`;
    const changedState = `${payload}.${changedSignature}`;

    const response = await callback(changedState, `oauth_nonce=${changedState}`);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/app/?oauth_error=invalid_state");
    expect(mocks.createSession).not.toHaveBeenCalled();
    expect(nonceCookie).not.toBe(`oauth_nonce=${changedState}`);
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

  it("does not create another session when Google rejects a reused authorization code", async () => {
    const { state, nonceCookie } = await startOAuth();
    const responses = [
      new Response(JSON.stringify({ access_token: "test-access-token" }), { status: 200 }),
      new Response(JSON.stringify({ email: oauthUser.email, name: oauthUser.name }), { status: 200 }),
      new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 }),
    ];
    globalThis.fetch = vi.fn(async (input: string | URL, init?: RequestInit) => {
      if (String(input).startsWith(baseUrl)) return originalGlobalFetch(input, init);
      const response = responses.shift();
      if (!response) throw new Error("Unexpected Google OAuth request");
      return response;
    });
    const firstResponse = await callback(state, nonceCookie);
    expect(firstResponse.status).toBe(200);

    const secondResponse = await callback(state, nonceCookie);

    expect(secondResponse.status).toBe(302);
    expect(secondResponse.headers.get("location")).toBe("/app/?oauth_error=token_exchange");
    expect(mocks.createSession).toHaveBeenCalledTimes(1);
  });

  it("retains the provider-denial and token-exchange error responses", async () => {
    const cancelled = await fetch(
      `${baseUrl}/api/auth/google/callback?error=access_denied`,
      { redirect: "manual" },
    );
    expect(cancelled.status).toBe(302);
    expect(cancelled.headers.get("location")).toBe("/app/?oauth_error=denied");

    const { state, nonceCookie } = await startOAuth();
    globalThis.fetch = vi.fn(async (input: string | URL, init?: RequestInit) => {
      if (String(input).startsWith(baseUrl)) return originalGlobalFetch(input, init);
      return new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 });
    });
    const tokenFailure = await callback(state, nonceCookie);
    expect(tokenFailure.status).toBe(302);
    expect(tokenFailure.headers.get("location")).toBe("/app/?oauth_error=token_exchange");
  });

  it("returns a translated configuration error for an unconfigured Google registration", async () => {
    const originalSecret = process.env.GOOGLE_CLIENT_SECRET;
    process.env.GOOGLE_CLIENT_SECRET = "";
    try {
      const response = await fetch(
        `${baseUrl}/api/auth/google?mode=register&profession=commercio`,
        { redirect: "manual" },
      );

      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe(
        "/app/?mode=register&oauth_error=oauth_configuration",
      );
    } finally {
      if (originalSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
      else process.env.GOOGLE_CLIENT_SECRET = originalSecret;
    }
  });

  it.each([
    { providerError: "access_denied", expected: "denied" },
    { providerError: "admin_policy_enforced", expected: "denied" },
    { providerError: "invalid_client", expected: "oauth_configuration" },
    { providerError: "server_error", expected: "oauth_temporary" },
    { providerError: "temporarily_unavailable", expected: "oauth_temporary" },
    { providerError: "unrecognized_google_error", expected: "provider_error" },
  ])("classifies Google authorization error $providerError safely", async ({ providerError, expected }) => {
    const { state, nonceCookie } = await startOAuth({
      mode: "register",
      profession: "commercio",
      organizationName: "Studio Test",
    });
    const privateProviderDescription = "provider details must not appear in the redirect";

    const response = await callback(state, nonceCookie, {
      error: providerError,
      error_description: privateProviderDescription,
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(`/app/?mode=register&oauth_error=${expected}`);
    expect(response.headers.get("location")).not.toContain(privateProviderDescription);
  });

  it.each([
    { providerError: "invalid_client", status: 401, expected: "oauth_configuration" },
    { providerError: "server_error", status: 503, expected: "oauth_temporary" },
    { providerError: "temporarily_unavailable", status: 503, expected: "oauth_temporary" },
    { providerError: "invalid_grant", status: 400, expected: "token_exchange" },
  ])("classifies Google token error $providerError without exposing provider details", async ({
    providerError,
    status,
    expected,
  }) => {
    const { state, nonceCookie } = await startOAuth({
      mode: "register",
      profession: "commercio",
      organizationName: "Studio Test",
    });
    const privateProviderDescription = "private-provider-error-description";
    globalThis.fetch = vi.fn(async (input: string | URL, init?: RequestInit) => {
      if (String(input).startsWith(baseUrl)) return originalGlobalFetch(input, init);
      return new Response(JSON.stringify({
        error: providerError,
        error_description: privateProviderDescription,
      }), { status });
    });

    const response = await callback(state, nonceCookie);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(`/app/?mode=register&oauth_error=${expected}`);
    expect(response.headers.get("location")).not.toContain(privateProviderDescription);
    expect(mocks.createSession).not.toHaveBeenCalled();
  });
});
