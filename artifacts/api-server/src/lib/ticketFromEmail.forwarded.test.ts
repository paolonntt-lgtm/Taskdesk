import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const makeTable = () => new Proxy({}, { get: (_target, key) => `${String(key)}` });
  const tables = {
    ticketsTable: makeTable(),
    usersTable: makeTable(),
    ticketActivityLogsTable: makeTable(),
    ticketCommentsTable: makeTable(),
    inboundEmailChannelsTable: makeTable(),
    ticketAttachmentsTable: makeTable(),
    clientsTable: makeTable(),
    emailClientSenderRulesTable: makeTable(),
    emailClientDomainRulesTable: makeTable(),
  };
  const db = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  };
  return {
    db,
    tables,
    clients: [] as Array<Record<string, unknown>>,
    senderRules: [] as Array<Record<string, unknown>>,
    domainRules: [] as Array<Record<string, unknown>>,
    inserts: [] as Array<{ table: unknown; values: Record<string, unknown> }>,
    systemUser: { id: 80, organizationId: 7, name: "Sistema" },
  };
});

vi.mock("@workspace/db", () => ({
  db: mocks.db,
  ...mocks.tables,
}));

vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => args,
  eq: (...args: unknown[]) => args,
  inArray: (...args: unknown[]) => args,
  or: (...args: unknown[]) => args,
  sql: (...args: unknown[]) => args,
}));

vi.mock("./clientFeature", () => ({
  isClientFeatureEnabled: vi.fn(async () => true),
}));

vi.mock("./notifications", () => ({
  createNotificationsForSubscribers: vi.fn(async () => undefined),
  createNotificationsForTicket: vi.fn(async () => undefined),
  createNotificationForUser: vi.fn(async () => undefined),
  subscribeUserToTicket: vi.fn(async () => undefined),
}));

vi.mock("./inboundEmailNotificationPolicy", () => ({
  getInboundEmailNotificationTarget: () => ({ kind: "none" }),
}));

vi.mock("./logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("./objectStorage", () => ({
  ObjectStorageService: class {
    uploadBuffer = vi.fn(async () => "unused");
  },
}));

vi.mock("./onedriveGraph", () => ({
  syncOneDriveAttachment: vi.fn(async () => undefined),
}));

import { logger } from "./logger";
import { createTicketFromEmail } from "./ticketFromEmail";

function queryResultFor(table: unknown): unknown[] {
  if (table === mocks.tables.usersTable) return [mocks.systemUser];
  if (table === mocks.tables.ticketsTable) return [{ maxNum: 12 }];
  if (table === mocks.tables.clientsTable) return mocks.clients;
  if (table === mocks.tables.emailClientSenderRulesTable) return mocks.senderRules;
  if (table === mocks.tables.emailClientDomainRulesTable) return mocks.domainRules;
  return [];
}

describe("forwarded inbound ticket creation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.inserts.length = 0;
    mocks.senderRules = [];
    mocks.domainRules = [];
    mocks.clients = [
      {
        id: 21,
        organizationId: 7,
        name: "Forwarding Client",
        alias: null,
        email: "forwarder@forwarding.example",
        pec: null,
      },
      {
        id: 22,
        organizationId: 7,
        name: "Original Sender Client",
        alias: null,
        email: "customer@acme.example",
        pec: null,
      },
    ];

    mocks.db.select.mockImplementation(() => {
      let result: unknown[] = [];
      const query: Record<string, any> = {
        from: vi.fn((table: unknown) => {
          result = queryResultFor(table);
          return query;
        }),
        where: vi.fn(() => query),
        limit: vi.fn(async () => result),
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
          Promise.resolve(result).then(resolve, reject),
      };
      return query;
    });

    mocks.db.insert.mockImplementation((table: unknown) => ({
      values: (values: Record<string, unknown>) => {
        mocks.inserts.push({ table, values });
        const result = table === mocks.tables.ticketsTable
          ? [{ id: 901, ticketNumber: 13, ...values }]
          : [];
        return {
          returning: async () => result,
          then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
            Promise.resolve(result).then(resolve, reject),
        };
      },
    }));
  });

  const baseInput = {
    fromEmail: "forwarder@forwarding.example",
    originalSenderEmail: "customer@acme.example",
    fromName: "Forwarding Service",
    subject: "Support request",
    bodyText: "Please help with this request.",
    orgId: 7,
    messageId: "<forwarded-message@forwarding.example>",
    conversationId: "conversation-789",
  };

  it("matches the original customer when both it and the forwarding account belong to clients", async () => {
    await createTicketFromEmail(baseInput);

    const ticket = mocks.inserts.find(({ table }) => table === mocks.tables.ticketsTable)?.values;
    expect(ticket).toMatchObject({
      resource: "forwarder@forwarding.example",
      clientId: 22,
      emailMessageId: "<forwarded-message@forwarding.example>",
      emailConversationId: "conversation-789",
      emailClientAssociationReason: "original_sender",
      emailClientAssociationSource: "original_sender",
      emailClientAssociationForwarded: true,
    });
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({
      associationCriterion: "original_sender",
      externalSenderMatch: "profile_contact",
      originalSenderMatch: "profile_contact",
      forwarded: true,
      originalSenderStatus: "available",
    }), "Inbound email client association resolved");
  });

  it("uses the original sender only as a client-association fallback, not as the reply address", async () => {
    mocks.clients = [mocks.clients[1]];

    await createTicketFromEmail(baseInput);

    const ticket = mocks.inserts.find(({ table }) => table === mocks.tables.ticketsTable)?.values;
    expect(ticket).toMatchObject({
      resource: "forwarder@forwarding.example",
      clientId: 22,
      emailMessageId: "<forwarded-message@forwarding.example>",
      emailConversationId: "conversation-789",
      emailClientAssociationReason: "original_sender",
      emailClientAssociationSource: "original_sender",
      emailClientAssociationForwarded: true,
    });
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({
      associationCriterion: "original_sender",
      externalSenderMatch: "none",
      originalSenderStatus: "available",
      originalSenderMatch: "profile_contact",
    }), "Inbound email client association resolved");
    const associationLog = vi.mocked(logger.info).mock.calls.find(([, message]) =>
      message === "Inbound email client association resolved");
    expect(JSON.stringify(associationLog)).not.toContain("forwarder@forwarding.example");
    expect(JSON.stringify(associationLog)).not.toContain("customer@acme.example");
    expect(JSON.stringify(associationLog)).not.toContain("Forwarding Service");
    expect(JSON.stringify(associationLog)).not.toContain("Please help with this request.");
  });

  it("does not associate an unmatched original sender", async () => {
    mocks.clients = [];

    await createTicketFromEmail({
      ...baseInput,
      fromEmail: "unknown-forwarder@gmail.com",
      originalSenderEmail: "unknown-customer@unmatched.example",
    });

    const ticket = mocks.inserts.find(({ table }) => table === mocks.tables.ticketsTable)?.values;
    expect(ticket).toMatchObject({
      resource: "unknown-forwarder@gmail.com",
      clientId: null,
      suggestedClientId: null,
      emailClientAssociationReason: "no_match",
      emailClientAssociationSource: null,
      emailClientAssociationForwarded: true,
    });
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({
      associationCriterion: "none",
      externalSenderMatch: "none",
      forwarded: true,
      originalSenderStatus: "available",
      originalSenderMatch: "none",
    }), "Inbound email client association resolved");
  });

  it("records conflicts on the original sender without associating the ticket", async () => {
    mocks.clients = [
      {
        id: 31,
        organizationId: 7,
        name: "Original Client One",
        alias: null,
        email: "customer@acme.example",
        pec: null,
      },
      {
        id: 32,
        organizationId: 7,
        name: "Original Client Two",
        alias: null,
        email: null,
        pec: "customer@acme.example",
      },
    ];

    await createTicketFromEmail(baseInput);

    const ticket = mocks.inserts.find(({ table }) => table === mocks.tables.ticketsTable)?.values;
    expect(ticket).toMatchObject({
      clientId: null,
      emailClientAssociationReason: "conflict",
      emailClientAssociationSource: "original_sender",
      emailClientAssociationForwarded: true,
    });
  });

  it("does not use a legacy sender rule for a direct inbound email", async () => {
    mocks.clients = [{
      id: 22,
      organizationId: 7,
      name: "Different Client",
      alias: null,
      email: "known@other.example",
      pec: null,
    }];
    mocks.senderRules = [{
      organizationId: 7,
      senderEmail: "forwarder@forwarding.example",
      clientId: 22,
    }];

    await createTicketFromEmail({
      ...baseInput,
      originalSenderEmail: undefined,
    });

    const ticket = mocks.inserts.find(({ table }) => table === mocks.tables.ticketsTable)?.values;
    expect(ticket).toMatchObject({
      resource: "forwarder@forwarding.example",
      clientId: null,
      suggestedClientId: null,
    });
  });

  it("ignores a learned forwarding-address rule when the forwarded sender has no client match", async () => {
    mocks.clients = [{
      id: 22,
      organizationId: 7,
      name: "Original Sender Client",
      alias: null,
      email: "known@acme.example",
      pec: null,
    }];
    mocks.senderRules = [{
      organizationId: 7,
      senderEmail: "forwarder@forwarding.example",
      clientId: 22,
    }];

    await createTicketFromEmail({
      ...baseInput,
      originalSenderEmail: "unknown@other.example",
    });

    const ticket = mocks.inserts.find(({ table }) => table === mocks.tables.ticketsTable)?.values;
    expect(ticket).toMatchObject({
      resource: "forwarder@forwarding.example",
      clientId: null,
      suggestedClientId: null,
    });
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({
      associationCriterion: "none",
      externalSenderMatch: "none",
      forwarded: true,
      originalSenderStatus: "available",
    }), "Inbound email client association resolved");
  });

  it("ignores a learned forwarding-address rule when Fwd is present but the original sender is missing", async () => {
    mocks.clients = [{
      id: 22,
      organizationId: 7,
      name: "Original Sender Client",
      alias: null,
      email: "known@acme.example",
      pec: null,
    }];
    mocks.senderRules = [{
      organizationId: 7,
      senderEmail: "forwarder@forwarding.example",
      clientId: 22,
    }];

    await createTicketFromEmail({
      ...baseInput,
      originalSenderEmail: undefined,
      subject: "Fwd: Support request",
    });

    const ticket = mocks.inserts.find(({ table }) => table === mocks.tables.ticketsTable)?.values;
    expect(ticket).toMatchObject({
      resource: "forwarder@forwarding.example",
      clientId: null,
      suggestedClientId: null,
    });
  });

  it("keeps explicit client-contact matching for forwarded subjects", async () => {
    await createTicketFromEmail({
      ...baseInput,
      originalSenderEmail: undefined,
      subject: "Fw: Support request",
    });

    const ticket = mocks.inserts.find(({ table }) => table === mocks.tables.ticketsTable)?.values;
    expect(ticket).toMatchObject({
      resource: "forwarder@forwarding.example",
      clientId: 21,
    });
  });

  it("leaves a forwarded ticket unassociated when only the outer sender is a client contact", async () => {
    mocks.clients = [mocks.clients[0]];

    await createTicketFromEmail(baseInput);

    const ticket = mocks.inserts.find(({ table }) => table === mocks.tables.ticketsTable)?.values;
    expect(ticket).toMatchObject({
      resource: "forwarder@forwarding.example",
      clientId: null,
      emailClientAssociationReason: "no_match",
      emailClientAssociationSource: null,
    });
  });
});
