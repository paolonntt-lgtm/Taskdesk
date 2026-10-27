import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  authenticateInboundEmailWebhook,
  inboundEmailJsonParser,
  inboundEmailUrlEncodedParser,
} from "./inboundEmailWebhookMiddleware";

describe("inbound email webhook body parsing", () => {
  let server: ReturnType<ReturnType<typeof express>["listen"]> | undefined;

  afterEach(async () => {
    vi.unstubAllEnvs();
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server!.close((error) => error ? reject(error) : resolve());
      });
      server = undefined;
    }
  });

  async function startWebhook(token: string) {
    vi.stubEnv("INBOUND_EMAIL_TOKEN", token);
    const app = express();
    app.post(
      "/api/inbound-email",
      authenticateInboundEmailWebhook,
      inboundEmailJsonParser,
      inboundEmailUrlEncodedParser,
      (req, res) => res.json({ textLength: req.body.text.length }),
    );
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve, reject) => {
      server!.once("listening", resolve);
      server!.once("error", reject);
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test webhook did not bind a TCP port");
    return `http://127.0.0.1:${address.port}/api/inbound-email`;
  }

  it("parses a JSON email payload larger than the general 5 MB API limit", async () => {
    const url = await startWebhook("unit-test-token");
    const text = "x".repeat(6 * 1024 * 1024);
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-webhook-token": "unit-test-token" },
      body: JSON.stringify({ text }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ textLength: text.length });
  });

  it("rejects invalid tokens before parsing a large payload", async () => {
    const url = await startWebhook("unit-test-token");
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-webhook-token": "wrong-token" },
      body: JSON.stringify({ text: "x".repeat(6 * 1024 * 1024) }),
    });

    expect(response.status).toBe(401);
  });
});
