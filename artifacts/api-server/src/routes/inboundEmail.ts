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

/** Extract local part (everything before @) from an email address */
function extractLocalPart(address: string): string {
  const at = address.indexOf("@");
  return at > 0 ? address.slice(0, at).toLowerCase() : address.toLowerCase();
}

/** Extract inbound token from an address like tickets-abc123@inbound.taskdesk.it */
function extractToken(localPart: string): string | null {
  const m = /^tickets-([a-f0-9]{8,32})$/i.exec(localPart);
  return m ? m[1].toLowerCase() : null;
}

router.post("/inbound-email", async (req, res): Promise<void> => {
  const expectedToken = process.env.INBOUND_EMAIL_TOKEN;

  // Normalise the received token: the Cloudflare Worker may send the value
  // with trailing whitespace or a duplicated "?token=…" fragment caused by a
  // newline in the URL template.  Split on the first newline / "?" and trim.
  const rawToken = (req.query.token as string) || (req.headers["x-webhook-token"] as string) || "";
  const receivedToken = rawToken.split(/[\n\r?]/)[0].trim();

  if (!expectedToken) {
    req.log.warn("INBOUND_EMAIL_TOKEN not configured — rejecting request");
    res.status(503).json({ error: "Webhook not configured" });
    return;
  }

  if (receivedToken !== expectedToken) {
    req.log.warn({ received: receivedToken, raw: rawToken }, "Invalid inbound email token");
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

  // Resolve org + routing via inbound channel from To: address.
  // Checks slug (exact local-part match) first, then legacy tickets-{token} format.
  let resolvedOrgId: number | undefined;
  let resolvedChannelId: number | null = null;

  const toAddresses = extractToAddresses(body);
  for (const addr of toAddresses) {
    const localPart = extractLocalPart(addr);
    if (!localPart) continue;

    // 1. Try slug match (custom addresses like support_acme@domain)
    const [bySlug] = await db.select().from(inboundEmailChannelsTable)
      .where(eq(inboundEmailChannelsTable.slug, localPart));
    if (bySlug?.enabled) {
      resolvedOrgId = bySlug.organizationId;
      resolvedChannelId = bySlug.id;
      break;
    }

    // 2. Fall back to legacy tickets-{token} pattern
    const token = extractToken(localPart);
    if (!token) continue;
    const [byToken] = await db.select().from(inboundEmailChannelsTable)
      .where(eq(inboundEmailChannelsTable.token, token));
    if (byToken?.enabled) {
      resolvedOrgId = byToken.organizationId;
      resolvedChannelId = byToken.id;
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
