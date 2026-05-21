import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, inboundEmailChannelsTable } from "@workspace/db";
import { processInboundEmail } from "../lib/ticketFromEmail";

const router: IRouter = Router();

/**
 * Extracts plain-text content from a raw MIME multipart body.
 * If the string contains MIME boundaries, returns only the text/plain part.
 * Otherwise returns the string as-is.
 */
function extractPlainFromMime(raw: string): string {
  // Detect a MIME boundary: lines starting with "--" followed by alphanumeric chars
  const boundaryMatch = raw.match(/^--([A-Za-z0-9_+/=\-]{6,})/m);
  if (!boundaryMatch) {
    // Single-part: strip any leading MIME headers (header block ends at first blank line)
    const blankLine = raw.search(/\r?\n\r?\n/);
    if (blankLine !== -1 && /^[\w-]+:/m.test(raw.slice(0, blankLine))) {
      return raw.slice(blankLine).trim();
    }
    return raw;
  }

  const boundary = boundaryMatch[1].trim();
  // Split on --boundary (escaping special regex chars)
  const escaped = boundary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = raw.split(new RegExp(`--${escaped}(?:--)?\\s*`));

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    // Each part: headers, blank line, body
    const headerEnd = trimmed.search(/\r?\n\r?\n/);
    if (headerEnd === -1) continue;
    const headers = trimmed.slice(0, headerEnd).toLowerCase();
    const partBody = trimmed.slice(headerEnd).trim();
    if (headers.includes("content-type: text/plain")) {
      return partBody;
    }
  }

  // Fallback: return everything that isn't a boundary/header line
  return raw
    .split("\n")
    .filter((l) => !l.startsWith("--") && !/^[\w-]+:\s/.test(l))
    .join("\n")
    .trim();
}

function extractText(body: any): string {
  const raw = (
    body?.text ||
    body?.body_text ||
    body?.plain ||
    body?.body ||
    ""
  ).trim();
  return extractPlainFromMime(raw);
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

  // Log the raw payload structure for debugging (no sensitive content)
  req.log.info({
    bodyKeys: body ? Object.keys(body) : [],
    toRaw: body?.to ?? body?.To ?? body?.ToFull ?? body?.envelope?.to ?? "(missing)",
    fromRaw: body?.from ?? body?.From ?? body?.from_email ?? "(missing)",
    subject: body?.subject ?? body?.Subject ?? "(missing)",
    hasText: !!(body?.text || body?.body_text || body?.plain || body?.body),
    hasHeaders: !!body?.headers,
  }, "Inbound email webhook received");

  // Extract sender — handle "Name <email>" format
  const rawFrom = extractField(body, "from", "from_email", "sender_email", "From");
  const { email: fromEmail, name: fromNameParsed } = parseEmailAddress(rawFrom);
  const fromName = extractField(body, "from_name", "sender_name", "name") || fromNameParsed || fromEmail;
  const subject = extractField(body, "subject", "Subject") || "Support request";
  const bodyText = extractText(body);

  // Email headers for threading
  const headers: Record<string, string> = body?.headers ?? {};
  const messageId = extractField(body, "messageId", "message_id", "MessageID") || headers["message-id"] || headers["Message-ID"] || "";
  const inReplyTo = extractField(body, "inReplyTo", "in_reply_to", "InReplyTo") || headers["in-reply-to"] || headers["In-Reply-To"] || "";
  const references = extractField(body, "references", "References") || headers["references"] || headers["References"] || "";

  if (!fromEmail) {
    req.log.warn({ bodyKeys: body ? Object.keys(body) : [] }, "Inbound email missing sender address");
    res.status(400).json({ error: "Missing sender email" });
    return;
  }

  // Resolve org + routing via inbound channel from To: address.
  // Checks slug (exact local-part match) first, then legacy tickets-{token} format.
  let resolvedOrgId: number | undefined;
  let resolvedChannelId: number | null = null;

  const toAddresses = extractToAddresses(body);
  req.log.info({ toAddresses }, "Inbound email: resolved To addresses");

  for (const addr of toAddresses) {
    const localPart = extractLocalPart(addr);
    if (!localPart) continue;

    // 1. Try slug match (custom addresses like support_acme@domain)
    const [bySlug] = await db.select().from(inboundEmailChannelsTable)
      .where(eq(inboundEmailChannelsTable.slug, localPart));
    if (bySlug?.enabled) {
      resolvedOrgId = bySlug.organizationId;
      resolvedChannelId = bySlug.id;
      req.log.info({ localPart, channelId: bySlug.id }, "Inbound email: channel resolved via slug");
      break;
    }

    // 2. Fall back to legacy tickets-{token} pattern
    const token = extractToken(localPart);
    req.log.info({ localPart, extractedToken: token ?? "(no match)" }, "Inbound email: token extraction");
    if (!token) continue;
    const [byToken] = await db.select().from(inboundEmailChannelsTable)
      .where(eq(inboundEmailChannelsTable.token, token));
    if (byToken?.enabled) {
      resolvedOrgId = byToken.organizationId;
      resolvedChannelId = byToken.id;
      req.log.info({ token, channelId: byToken.id }, "Inbound email: channel resolved via token");
      break;
    } else {
      req.log.warn({ token, found: !!byToken, enabled: byToken?.enabled }, "Inbound email: token not matched to any enabled channel");
    }
  }

  if (!resolvedChannelId) {
    req.log.warn({ toAddresses }, "Inbound email: no channel resolved from To addresses");
  }

  // Fall back to env-configured org if no token matched
  if (!resolvedOrgId && process.env.INBOUND_EMAIL_ORG_ID) {
    resolvedOrgId = parseInt(process.env.INBOUND_EMAIL_ORG_ID, 10);
    req.log.info({ resolvedOrgId }, "Inbound email: org resolved via INBOUND_EMAIL_ORG_ID env fallback");
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
    req.log.info({ from: fromEmail, orgId: resolvedOrgId, inboundChannelId: resolvedChannelId }, "Inbound email processed successfully");
    res.status(200).json({ ok: true });
  } catch (err: any) {
    req.log.error({ err }, "Failed to process inbound email webhook");
    res.status(500).json({ error: err?.message ?? "Internal error" });
  }
});

export default router;
