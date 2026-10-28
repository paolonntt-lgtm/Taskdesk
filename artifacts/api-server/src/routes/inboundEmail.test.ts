import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  processInboundEmail: vi.fn(async () => undefined),
  db: { select: vi.fn() },
}));

vi.mock("@workspace/db", () => ({
  db: mocks.db,
  inboundEmailChannelsTable: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: (...args: unknown[]) => args,
}));

vi.mock("../lib/ticketFromEmail", () => ({
  processInboundEmail: mocks.processInboundEmail,
}));

import router from "./inboundEmail";

describe("inbound email webhook threading metadata", () => {
  let server: ReturnType<express.Express["listen"]> | undefined;

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = undefined;
    }
    vi.clearAllMocks();
  });

  it("passes the forwarded sender, message ID, and provider conversation ID into ticket processing", async () => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
      next();
    });
    app.use(router);
    server = app.listen(0);
    await new Promise<void>((resolve) => server!.once("listening", resolve));

    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not bind to a TCP port");

    const response = await fetch(`http://127.0.0.1:${address.port}/inbound-email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        from: "Forwarding Service <forwarder@forwarding.example>",
        subject: "Fwd: Support request",
        text: "FYI\n\n---------- Forwarded message ---------\nFrom: customer@acme.example\nSubject: Support request",
        messageId: "<forwarded-message@forwarding.example>",
        conversationId: "conversation-789",
      }),
    });

    expect(response.status).toBe(200);
    expect(mocks.processInboundEmail).toHaveBeenCalledWith(expect.objectContaining({
      fromEmail: "forwarder@forwarding.example",
      originalSenderEmail: "customer@acme.example",
      messageId: "<forwarded-message@forwarding.example>",
      conversationId: "conversation-789",
    }));
  });
});
