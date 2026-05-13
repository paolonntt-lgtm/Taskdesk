import { Router, type IRouter } from "express";
import { createTicketFromEmail } from "../lib/ticketFromEmail";

const router: IRouter = Router();

function extractText(body: any): string {
  return (
    body?.text ||
    body?.body_text ||
    body?.plain ||
    body?.body ||
    ""
  ).trim();
}

function extractField(body: any, ...keys: string[]): string {
  for (const k of keys) {
    if (body?.[k] && typeof body[k] === "string") return body[k].trim();
  }
  return "";
}

router.post("/inbound-email", async (req, res): Promise<void> => {
  const expectedToken = process.env.INBOUND_EMAIL_TOKEN;
  const receivedToken = (req.query.token as string) || req.headers["x-webhook-token"];

  if (!expectedToken) {
    req.log.warn("INBOUND_EMAIL_TOKEN not configured — rejecting request");
    res.status(503).json({ error: "Webhook not configured" });
    return;
  }

  if (receivedToken !== expectedToken) {
    req.log.warn({ received: receivedToken }, "Invalid inbound email token");
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const body = req.body;
  const fromEmail = extractField(body, "from_email", "from", "sender_email");
  const fromName = extractField(body, "from_name", "sender_name", "name") || fromEmail;
  const subject = extractField(body, "subject") || "Richiesta di assistenza";
  const bodyText = extractText(body);

  if (!fromEmail) {
    req.log.warn({ body }, "Inbound email missing sender address");
    res.status(400).json({ error: "Missing sender email" });
    return;
  }

  const orgIdEnv = process.env.INBOUND_EMAIL_ORG_ID
    ? parseInt(process.env.INBOUND_EMAIL_ORG_ID, 10)
    : undefined;

  try {
    const result = await createTicketFromEmail({ fromEmail, fromName, subject, bodyText, orgId: orgIdEnv });
    req.log.info({ ...result, from: fromEmail }, "Inbound webhook email ticket created");
    res.status(200).json({ ok: true, ...result });
  } catch (err: any) {
    req.log.error({ err }, "Failed to create ticket from inbound email");
    res.status(500).json({ error: err?.message ?? "Internal error" });
  }
});

export default router;
