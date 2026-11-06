import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  admins: [] as Array<Record<string, unknown>>,
  subscriptions: [] as Array<Record<string, unknown>>,
  select: vi.fn(),
  update: vi.fn(),
  sendEmail: vi.fn(),
  getSubscriptions: vi.fn(),
}));

vi.mock("@workspace/db", () => ({
  db: {
    select: mocks.select,
    update: mocks.update,
  },
  usersTable: {
    role: {}, isActive: {}, stripeSubscriptionId: {}, name: {}, email: {}, preferredLanguage: {}, organizationId: {},
  },
  organizationsTable: {
    id: {}, name: {}, subscriptionExpiryReminderKey: {}, subscriptionExpiryReminderSentAt: {},
  },
}));

vi.mock("../stripeStorage", () => ({
  stripeStorage: { getSubscriptions: mocks.getSubscriptions },
}));

vi.mock("./appUrl", () => ({ appBaseUrl: () => "https://taskdesk.example" }));
vi.mock("./email", () => ({
  buildSubscriptionEndingReminderEmail: (args: { billingUrl: string; adminName: string; orgName: string; endsAt: Date }) => ({
    subject: `Ending ${args.orgName}`,
    html: `<a href="${args.billingUrl}">${args.adminName}</a>`,
    text: args.endsAt.toISOString(),
  }),
  sendEmailForOrg: mocks.sendEmail,
}));
vi.mock("./logger", () => ({ logger: { info: vi.fn(), warn: vi.fn() } }));

import { checkSubscriptionExpiryReminders } from "./subscriptionExpiryReminderJob";

describe("paid subscription expiry reminders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.admins = [{
      name: "Paolo",
      email: "paolo@example.test",
      language: "it",
      organizationId: 4,
      organizationName: "Studio",
      subscriptionId: "sub-1",
      reminderKey: null,
    }];
    mocks.subscriptions = [{
      id: "sub-1",
      status: "active",
      cancel_at: Math.floor(Date.UTC(2026, 10, 9) / 1000),
      current_period_end: Math.floor(Date.UTC(2026, 10, 9) / 1000),
    }];
    mocks.select.mockImplementation(() => {
      const query: Record<string, any> = {};
      query.from = vi.fn(() => query);
      query.leftJoin = vi.fn(() => query);
      query.where = vi.fn(async () => mocks.admins);
      return query;
    });
    mocks.update.mockImplementation(() => {
      const query: Record<string, any> = {};
      query.set = vi.fn(() => query);
      query.where = vi.fn(async () => undefined);
      return query;
    });
    mocks.getSubscriptions.mockImplementation(async () => mocks.subscriptions);
    mocks.sendEmail.mockResolvedValue({ ok: true });
  });

  it("emails the billing admin once when a scheduled cancellation is within four days", async () => {
    await checkSubscriptionExpiryReminders(new Date(Date.UTC(2026, 10, 6)));

    expect(mocks.sendEmail).toHaveBeenCalledWith(4, expect.objectContaining({
      to: "paolo@example.test",
      subject: "Ending Studio",
    }));
    expect(mocks.update).toHaveBeenCalled();
  });

  it("does not warn about an ordinary automatic renewal", async () => {
    mocks.subscriptions = [{ ...mocks.subscriptions[0], cancel_at: null }];

    await checkSubscriptionExpiryReminders(new Date(Date.UTC(2026, 10, 6)));

    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("does not send a duplicate reminder for the same scheduled end", async () => {
    const cancelAt = Math.floor(Date.UTC(2026, 10, 9) / 1000);
    mocks.admins = [{ ...mocks.admins[0], reminderKey: `sub-1:${cancelAt}` }];

    await checkSubscriptionExpiryReminders(new Date(Date.UTC(2026, 10, 6)));

    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });
});
