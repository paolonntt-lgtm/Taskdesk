import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, inboundEmailChannelsTable } from "@workspace/db";
import { processInboundEmail } from "../lib/ticketFromEmail";

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

/** Parse "Name <email>" or "email" → { name, email } */
function parseEmailAddress(raw: string): { email: string; name: string } {
  const m = /^(.+?)\s*<([^>]+)>\s*$/.exec(raw.trim());
  if (m) return { name: m[1].trim(), email: m[2].trim() };
  return { name: raw.trim(), email: raw.trim() };
}

/** Extract all To: addresses from different provider payload shapes */
function extractToAddresses(body: any): string[] {
  if (Array.isArray(body?.to)) return body.to.map((a: any) => String(a));
  if (typeof body?.to === "string") return [body.to];
  if (Array.isArray(body?.ToFull)) return body.ToFull.map((a: any) => a?.Email ?? String(a));
  if (typeof body?.To === "string") return [body.To];
  // Resend format: envelope.to
  if (Array.isArray(body?.envelope?.to)) return body.envelope.to;
  return [];
}

/** Extract inbound token from an email address like tickets-abc123@inbound.taskdesk.it */
function extractToken(address: string): string | null {
  const m = /tickets-([a-f0-9]{8,32})/i.exec(address);
  return m ? m[1].toLowerCase() : null;
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

  // Extract sender — handle "Name <email>" format
  const rawFrom = extractField(body, "from", "from_email", "sender_email", "From");
  const { email: fromEmail, name: fromNameParsed } = parseEmailAddress(rawFrom);
  const fromName = extractField(body, "from_name", "sender_name", "name") || fromNameParsed || fromEmail;
  const subject = extractField(body, "subject", "Subject") || "Richiesta di assistenza";
  const bodyText = extractText(body);

  // Email headers for threading
  const headers: Record<string, string> = body?.headers ?? {};
  const messageId = extractField(body, "messageId", "message_id", "MessageID") || headers["message-id"] || headers["Message-ID"] || "";
  const inReplyTo = extractField(body, "inReplyTo", "in_reply_to", "InReplyTo") || headers["in-reply-to"] || headers["In-Reply-To"] || "";
  const references = extractField(body, "references", "References") || headers["references"] || headers["References"] || "";

  if (!fromEmail) {
    req.log.warn({ body }, "Inbound email missing sender address");
    res.status(400).json({ error: "Missing sender email" });
    return;
  }

  // Resolve org + routing via inbound channel token from To: address
  let resolvedOrgId: number | undefined;
  let resolvedChannelId: number | null = null;

  const toAddresses = extractToAddresses(body);
  for (const addr of toAddresses) {
    const token = extractToken(addr);
    if (!token) continue;
    const [channel] = await db.select().from(inboundEmailChannelsTable)
      .where(eq(inboundEmailChannelsTable.token, token));
    if (channel && channel.enabled) {
      resolvedOrgId = channel.organizationId;
      resolvedChannelId = channel.id;
      break;
    }
  }

  // Fall back to env-configured org if no token matched
  if (!resolvedOrgId && process.env.INBOUND_EMAIL_ORG_ID) {
    resolvedOrgId = parseInt(process.env.INBOUND_EMAIL_ORG_ID, 10);
  }

  try {
    await processInboundEmail({
      fromEmail,
      fromName,
      subject,
      bodyText,
      orgId: resolvedOrgId,
      messageId: messageId || undefined,
      inReplyTo: inReplyTo || undefined,
      references: references || undefined,
      inboundChannelId: resolvedChannelId,
    });
    req.log.info({ from: fromEmail, orgId: resolvedOrgId, inboundChannelId: resolvedChannelId }, "Inbound webhook email processed");
    res.status(200).json({ ok: true });
  } catch (err: any) {
    req.log.error({ err }, "Failed to process inbound email webhook");
    res.status(500).json({ error: err?.message ?? "Internal error" });
  }
});

export default router;
