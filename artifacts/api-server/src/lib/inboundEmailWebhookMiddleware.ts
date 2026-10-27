import express, { type RequestHandler } from "express";
import { timingSafeEqual } from "node:crypto";

export const inboundEmailJsonParser = express.json({ limit: "32mb" });
export const inboundEmailUrlEncodedParser = express.urlencoded({ extended: true, limit: "32mb" });

export const authenticateInboundEmailWebhook: RequestHandler = (req, res, next) => {
  const expectedToken = process.env.INBOUND_EMAIL_TOKEN;
  if (!expectedToken) {
    (req as any).log?.warn("INBOUND_EMAIL_TOKEN not configured — rejecting request");
    res.status(503).json({ error: "Webhook not configured" });
    req.resume();
    return;
  }

  const rawToken = (req.query.token as string) || (req.headers["x-webhook-token"] as string) || "";
  const receivedToken = rawToken.split(/[\n\r?]/)[0].trim();
  const expectedBuf = Buffer.from(expectedToken, "utf8");
  const receivedBuf = Buffer.from(receivedToken, "utf8");
  const tokenValid = expectedBuf.length === receivedBuf.length
    && timingSafeEqual(expectedBuf, receivedBuf);

  if (!tokenValid) {
    (req as any).log?.warn({ rawToken }, "Invalid inbound email token");
    res.status(401).json({ error: "Unauthorized" });
    req.resume();
    return;
  }

  next();
};
