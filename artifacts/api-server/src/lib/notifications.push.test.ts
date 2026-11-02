import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const organizationsTable = { isSharedWorkspace: "organizations.isSharedWorkspace" };
  const usersTable = {
    id: "users.id",
    role: "users.role",
    name: "users.name",
    email: "users.email",
    expoPushToken: "users.expoPushToken",
    preferredLanguage: "users.preferredLanguage",
    isActive: "users.isActive",
  };
  const notificationPreferencesTable = {
    userId: "notificationPreferences.userId",
    type: "notificationPreferences.type",
    inApp: "notificationPreferences.inApp",
    email: "notificationPreferences.email",
  };

  return {
    db: {
      select: vi.fn(),
      insert: vi.fn(),
    },
    organizationsTable,
    usersTable,
    notificationPreferencesTable,
    notificationsTable: { notificationText: "notifications.notificationText" },
    workspaceMembershipsTable: { userId: "members.userId", role: "members.role" },
    ticketSubscriptionsTable: { userId: "subscriptions.userId", ticketId: "subscriptions.ticketId" },
    ticketsTable: { visibility: "tickets.visibility", id: "tickets.id" },
    insertedNotifications: [] as Array<Array<Record<string, unknown>>>,
    fetch: vi.fn(),
  };
});

vi.mock("drizzle-orm", () => ({
  and: (...values: unknown[]) => values,
  eq: (...values: unknown[]) => values,
  inArray: (...values: unknown[]) => values,
  ne: (...values: unknown[]) => values,
}));

vi.mock("@workspace/db", () => ({
  db: mocks.db,
  organizationsTable: mocks.organizationsTable,
  usersTable: mocks.usersTable,
  notificationPreferencesTable: mocks.notificationPreferencesTable,
  notificationsTable: mocks.notificationsTable,
  workspaceMembershipsTable: mocks.workspaceMembershipsTable,
  ticketSubscriptionsTable: mocks.ticketSubscriptionsTable,
  ticketsTable: mocks.ticketsTable,
}));

vi.mock("./email", () => ({
  sendEmailForOrg: vi.fn().mockResolvedValue({ ok: true }),
  buildNotificationEmail: vi.fn(),
}));

vi.mock("./appUrl", () => ({
  appBaseUrl: () => "https://taskdesk.example",
}));

import { createNotificationsForOrg } from "./notifications";

describe("push notification localization", () => {
  afterEach(() => vi.unstubAllGlobals());

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.insertedNotifications.length = 0;

    const selectResults: unknown[][] = [
      [],
      [{ shared: false }],
      [{ id: 11, role: "user" }, { id: 22, role: "user" }],
      [
        {
          id: 11,
          name: "Giulia",
          email: null,
          expoPushToken: "expo-token-it",
          preferredLanguage: "it",
        },
        {
          id: 22,
          name: "Jamie",
          email: null,
          expoPushToken: "expo-token-en",
          preferredLanguage: "en",
        },
      ],
      [],
    ];
    mocks.db.select.mockImplementation(() => {
      const result = selectResults.shift() ?? [];
      const query: any = {
        from: () => query,
        innerJoin: () => query,
        where: () => query,
        limit: () => query,
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
          Promise.resolve(result).then(resolve, reject),
      };
      return query;
    });

    mocks.db.insert.mockImplementation(() => ({
      values: (values: Array<Record<string, unknown>>) => {
        mocks.insertedNotifications.push(values);
        return Promise.resolve();
      },
    }));

    vi.stubGlobal("fetch", mocks.fetch);
    mocks.fetch.mockResolvedValue({ ok: true });
  });

  it("sends each recipient their language in one Expo broadcast, matching the in-app text", async () => {
    await createNotificationsForOrg(
      5,
      99,
      {
        key: "ticket_assigned",
        actorName: "Alex",
        ticketNumber: 42,
        ticketTitle: "Printer offline",
      },
      "ticket_assigned",
      42,
    );

    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    const [, request] = mocks.fetch.mock.calls[0] as [string, RequestInit];
    const pushMessages = JSON.parse(request.body as string) as Array<{
      to: string;
      body: string;
      title: string;
    }>;

    expect(pushMessages).toEqual([
      {
        to: "expo-token-it",
        sound: "default",
        title: "TaskDesk",
        body: 'Alex ti ha assegnato il ticket #42: "Printer offline"',
        data: { ticketId: 42 },
      },
      {
        to: "expo-token-en",
        sound: "default",
        title: "TaskDesk",
        body: 'Alex assigned you ticket #42: "Printer offline"',
        data: { ticketId: 42 },
      },
    ]);

    expect(mocks.insertedNotifications).toHaveLength(1);
    const inAppTextByUser = new Map(
      mocks.insertedNotifications[0].map((notification) => [
        notification.userId,
        notification.notificationText,
      ]),
    );
    expect(inAppTextByUser.get(11)).toBe(pushMessages[0].body);
    expect(inAppTextByUser.get(22)).toBe(pushMessages[1].body);
  });
});
