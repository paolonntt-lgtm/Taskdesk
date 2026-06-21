import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, inboundEmailChannelsTable } from "@workspace/db";
import { processInboundEmail } from "../lib/ticketFromEmail";
import type { InboundAttachment } from "../lib/ticketFromEmail";

const router: IRouter = Router();

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MIME_PREFIXES = [
  "image/",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument",
  "application/vnd.ms-",
  "application/vnd.oasis.opendocument",
  "application/zip",
  "application/x-zip-compressed",
  "application/x-zip",
  "application/rtf",
  "application/json",
];

function isMimeAllowed(mimeType: string): boolean {
  const mt = mimeType.toLowerCase().split(";")[0].trim();
  return ALLOWED_MIME_PREFIXES.some((p) => mt.startsWith(p));
}

// ---------------------------------------------------------------------------
// MIME parsing helpers
// ---------------------------------------------------------------------------

function parseHeaders(headerBlock: string): Record<string, string> {
  const unfolded = headerBlock.replace(/\r?\n[ \t]+/g, " ");
  const headers: Record<string, string> = {};
  for (const line of unfolded.split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx > 0) {
      headers[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim();
    }
  }
  return headers;
}

function extractBoundary(contentType: string): string | null {
  const m = /boundary="?([^";]+)"?/i.exec(contentType);
  return m ? m[1].trim() : null;
}

function decodeQuotedPrintable(input: string): string {
  return input
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function decodeBodyText(raw: string, encoding: string): string {
  const enc = encoding.toLowerCase().trim();
  if (enc === "base64") {
    try {
      return Buffer.from(raw.replace(/\s/g, ""), "base64").toString("utf8");
    } catch {
      return raw;
    }
  }
  if (enc === "quoted-printable") {
    return decodeQuotedPrintable(raw);
  }
  return raw;
}

function decodeBodyBuffer(raw: string, encoding: string): Buffer {
  const enc = encoding.toLowerCase().trim();
  if (enc === "base64") {
    try {
      return Buffer.from(raw.replace(/\s/g, ""), "base64");
    } catch {
      return Buffer.alloc(0);
    }
  }
  return Buffer.from(raw, "utf8");
}

function extractFilename(headerValue: string): string {
  const m =
    /filename\*=UTF-8''([^\s;]+)/i.exec(headerValue) ||
    /filename\*=([^\s;]+)/i.exec(headerValue) ||
    /filename="([^"]+)"/i.exec(headerValue) ||
    /filename=([^\s;]+)/i.exec(headerValue);
  if (m) {
    try {
      return decodeURIComponent(m[1].trim().replace(/^["']|["']$/g, ""));
    } catch {
      return m[1].trim().replace(/^["']|["']$/g, "");
    }
  }
  return "";
}

interface RawMimePart {
  headers: Record<string, string>;
  body: string;
}

function splitIntoParts(body: string, boundary: string): RawMimePart[] {
  const escaped = boundary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const splitRe = new RegExp(`(?:^|\\r?\\n)--${escaped}(?:--)?[ \\t]*(?:\\r?\\n|$)`);
  const chunks = body.split(splitRe);
  const parts: RawMimePart[] = [];
  for (const chunk of chunks) {
    if (!chunk.trim()) continue;
    const sep = chunk.search(/\r?\n\r?\n/);
    if (sep === -1) continue;
    const headerBlock = chunk.slice(0, sep);
    const partBody = chunk.slice(sep + 1).replace(/^\r?\n/, "");
    parts.push({ headers: parseHeaders(headerBlock), body: partBody });
  }
  return parts;
}

interface CollectedData {
  textParts: string[];
  htmlParts: string[];
  attachments: Array<{ filename: string; mimeType: string; rawBody: string; encoding: string }>;
}

function collectRecursive(headers: Record<string, string>, body: string, out: CollectedData): void {
  const ct = (headers["content-type"] || "").trim();
  const cd = (headers["content-disposition"] || "").trim();
  const cte = (headers["content-transfer-encoding"] || "").toLowerCase().trim();
  const baseType = ct.split(";")[0].trim().toLowerCase();

  if (baseType.startsWith("multipart/")) {
    const boundary = extractBoundary(ct);
    if (!boundary) return;
    const subParts = splitIntoParts(body, boundary);
    for (const sub of subParts) {
      collectRecursive(sub.headers, sub.body, out);
    }
    return;
  }

  const isAttachment = /\battachment\b/i.test(cd);

  if (isAttachment) {
    const filename =
      extractFilename(cd) ||
      extractFilename(ct) ||
      "attachment";
    out.attachments.push({ filename, mimeType: baseType || "application/octet-stream", rawBody: body, encoding: cte });
    return;
  }

  if (baseType === "text/plain") {
    out.textParts.push(decodeBodyText(body, cte));
    return;
  }

  if (baseType === "text/html") {
    const decoded = decodeBodyText(body, cte);
    const text = decoded
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<\/tr>/gi, "\n")
      .replace(/<\/h[1-6]>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    out.htmlParts.push(text);
    return;
  }
}

/**
 * Parse a raw MIME string (full message or body-only) into plain text and
 * a list of attachment descriptors. Handles nested multipart structures.
 */
function parseMimeMessage(raw: string): { text: string; rawAttachments: CollectedData["attachments"] } {
  const out: CollectedData = { textParts: [], htmlParts: [], attachments: [] };

  // Try to parse as a complete MIME message (headers + blank line + body)
  const blankIdx = raw.search(/\r?\n\r?\n/);
  if (blankIdx !== -1 && /^[\w-]+:/m.test(raw.slice(0, blankIdx))) {
    const headerBlock = raw.slice(0, blankIdx);
    const body = raw.slice(blankIdx + 1).replace(/^\r?\n/, "");
    const headers = parseHeaders(headerBlock);
    collectRecursive(headers, body, out);
  } else {
    // Try direct boundary split (body-only multipart)
    const boundaryMatch = raw.match(/^--([A-Za-z0-9_+/=\-]{6,})/m);
    if (boundaryMatch) {
      const boundary = boundaryMatch[1].trim();
      const subParts = splitIntoParts(raw, boundary);
      for (const sub of subParts) {
        collectRecursive(sub.headers, sub.body, out);
      }
    }
  }

  const text = out.textParts.length > 0
    ? out.textParts.join("\n").trim()
    : out.htmlParts.length > 0
    ? out.htmlParts.join("\n").trim()
    : "";

  return { text, rawAttachments: out.attachments };
}

// ---------------------------------------------------------------------------
// PEC (Posta Elettronica Certificata) support
// ---------------------------------------------------------------------------

type PecUnwrapResult =
  | { isPec: false }
  | { isPec: true; isReceipt: true }
  | { isPec: true; isReceipt: false; text: string; attachments: InboundAttachment[]; subject: string | null };

/**
 * Detects and unwraps PEC (certified email) envelopes.
 *
 * PEC envelopes are identified by:
 *   - X-Trasporto: posta-certificata (or posta-certificata-sicura) header
 *   - Presence of daticert.xml or postacert.eml attachments
 *
 * PEC receipts (avvenuta-consegna, rilevazione-virus) are flagged for silent discard.
 *
 * When a PEC envelope is detected, the function extracts the original message from
 * postacert.eml, parses it, and returns the real body text, subject, and attachments.
 */
function tryUnwrapPec(
  rawMime: string,
  providerHeaders: Record<string, string>,
): PecUnwrapResult {
  // Normalize X-Trasporto from provider-supplied headers (any case)
  const providerXTrasporto = Object.entries(providerHeaders)
    .find(([k]) => k.toLowerCase() === "x-trasporto")?.[1]
    ?.toLowerCase()
    .trim() ?? "";

  // Also read from the raw MIME header block
  let mimeXTrasporto = "";
  if (rawMime) {
    const blankIdx = rawMime.search(/\r?\n\r?\n/);
    if (blankIdx !== -1 && /^[\w-]+:/m.test(rawMime.slice(0, blankIdx))) {
      const mimeHeaders = parseHeaders(rawMime.slice(0, blankIdx));
      mimeXTrasporto = (mimeHeaders["x-trasporto"] || "").toLowerCase().trim();
    }
  }

  const xTrasporto = providerXTrasporto || mimeXTrasporto;

  // Silently discard PEC receipts — they are not actionable messages
  const PEC_DISCARD_TYPES = new Set([
    "avvenuta-consegna",
    "errore-consegna",
    "presa-in-carico",
    "avvenuta-presa-in-carico",
    "rilevazione-virus",
  ]);
  if (PEC_DISCARD_TYPES.has(xTrasporto)) {
    return { isPec: true, isReceipt: true };
  }

  const isPecByHeader =
    xTrasporto === "posta-certificata" || xTrasporto === "posta-certificata-sicura";

  // Parse the raw MIME to find PEC attachment signals even when the header is absent
  let mimeRawAttachments: CollectedData["attachments"] = [];
  if (rawMime) {
    const { rawAttachments } = parseMimeMessage(rawMime);
    mimeRawAttachments = rawAttachments;
  }

  // Require both the correct filename AND a compatible MIME type to avoid
  // false-positive matches against other embedded RFC 822 messages (e.g. forwarded emails).
  const postacertPart = mimeRawAttachments.find(
    (a) =>
      a.filename.toLowerCase() === "postacert.eml" &&
      (a.mimeType === "message/rfc822" || a.mimeType === "application/octet-stream"),
  );
  const hasDaticertXml = mimeRawAttachments.some(
    (a) => a.filename.toLowerCase() === "daticert.xml",
  );

  if (!isPecByHeader && !postacertPart && !hasDaticertXml) {
    return { isPec: false };
  }

  // PEC envelope detected — extract original message from postacert.eml
  if (!postacertPart) {
    // We have PEC signals but no original message to unwrap — fall through
    return { isPec: false };
  }

  const postacertRaw = decodeBodyText(postacertPart.rawBody, postacertPart.encoding);

  // Extract subject from the original message's headers
  let innerSubject: string | null = null;
  const innerBlankIdx = postacertRaw.search(/\r?\n\r?\n/);
  if (innerBlankIdx !== -1) {
    const innerHeaders = parseHeaders(postacertRaw.slice(0, innerBlankIdx));
    innerSubject = innerHeaders["subject"]?.trim() || null;
  }

  // Parse the original message body + attachments
  const { text: innerText, rawAttachments: innerRawAttachments } = parseMimeMessage(postacertRaw);

  // Build final attachments: skip daticert.xml; keep real attachments
  const innerAttachments: InboundAttachment[] = [];
  for (const ra of innerRawAttachments) {
    if (ra.filename.toLowerCase() === "daticert.xml") continue;
    if (!isMimeAllowed(ra.mimeType)) continue;
    const data = decodeBodyBuffer(ra.rawBody, ra.encoding);
    const oversized = data.length > MAX_ATTACHMENT_BYTES;
    innerAttachments.push({
      filename: ra.filename,
      mimeType: ra.mimeType,
      data: oversized ? Buffer.alloc(0) : data,
      oversized,
    });
  }

  return { isPec: true, isReceipt: false, text: innerText, attachments: innerAttachments, subject: innerSubject };
}

/**
 * Extracts plain text and attachment list from a webhook payload.
 * Tries provider-supplied parsed fields first, then falls back to raw MIME parsing.
 * Handles PEC (Posta Elettronica Certificata) envelopes transparently.
 */
function extractTextAndAttachments(body: any): {
  text: string;
  attachments: InboundAttachment[];
  overrideSubject?: string;
  discard?: boolean;
} {
  const attachments: InboundAttachment[] = [];

  // --- 0. PEC detection — run before any provider-text shortcut ---
  // Use the raw MIME payload and provider-supplied headers to detect PEC envelopes.
  const rawMimeForPec: string = (body?.body || body?.rawMail || "").trim();
  const providerHeaders: Record<string, string> = (body?.headers && typeof body.headers === "object")
    ? body.headers as Record<string, string>
    : {};

  const pecResult = tryUnwrapPec(rawMimeForPec, providerHeaders);

  if (pecResult.isPec && pecResult.isReceipt) {
    return { text: "", attachments: [], discard: true };
  }

  if (pecResult.isPec && !pecResult.isReceipt) {
    return {
      text: pecResult.text,
      attachments: pecResult.attachments,
      overrideSubject: pecResult.subject ?? undefined,
    };
  }

  // --- 1. Provider-supplied text field + provider-supplied attachments array ---
  const providerText: string = (
    body?.text ||
    body?.body_text ||
    body?.plain ||
    ""
  ).trim();

  // Some providers (Postmark, SendGrid, etc.) supply parsed attachment arrays
  const providerAttachments: any[] = Array.isArray(body?.attachments) ? body.attachments : [];

  for (const att of providerAttachments) {
    const filename: string = (att?.filename || att?.name || att?.FileName || "attachment").trim();
    const mimeType: string = (att?.content_type || att?.ContentType || att?.type || "application/octet-stream")
      .split(";")[0]
      .trim()
      .toLowerCase();
    const contentB64: string = att?.content || att?.data || att?.Content || "";

    if (!isMimeAllowed(mimeType)) continue;

    const data = contentB64 ? Buffer.from(contentB64.replace(/\s/g, ""), "base64") : Buffer.alloc(0);
    const oversized = data.length > MAX_ATTACHMENT_BYTES;
    attachments.push({ filename, mimeType, data: oversized ? Buffer.alloc(0) : data, oversized });
  }

  // If we got provider text and at least some attachment signal, use provider text
  if (providerText) {
    // Still check the raw body for attachments the provider may have missed
    const rawMime: string = (body?.body || body?.rawMail || "").trim();
    if (rawMime && attachments.length === 0) {
      const { rawAttachments } = parseMimeMessage(rawMime);
      for (const ra of rawAttachments) {
        if (!isMimeAllowed(ra.mimeType)) continue;
        const data = decodeBodyBuffer(ra.rawBody, ra.encoding);
        const oversized = data.length > MAX_ATTACHMENT_BYTES;
        attachments.push({ filename: ra.filename, mimeType: ra.mimeType, data: oversized ? Buffer.alloc(0) : data, oversized });
      }
    }
    return { text: providerText, attachments };
  }

  // --- 2. Fall back to raw MIME parsing ---
  const rawMime: string = (body?.body || body?.rawMail || body?.body_text || "").trim();
  if (rawMime) {
    const { text, rawAttachments } = parseMimeMessage(rawMime);
    for (const ra of rawAttachments) {
      if (!isMimeAllowed(ra.mimeType)) continue;
      const data = decodeBodyBuffer(ra.rawBody, ra.encoding);
      const oversized = data.length > MAX_ATTACHMENT_BYTES;
      attachments.push({ filename: ra.filename, mimeType: ra.mimeType, data: oversized ? Buffer.alloc(0) : data, oversized });
    }
    return { text: text || rawMime, attachments };
  }

  return { text: "", attachments: [] };
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

/**
 * Detects automated / auto-reply messages that should never create a ticket.
 * Checks RFC-standard headers, common mailer patterns, and PEC-specific subjects.
 */
function isAutoReply(headers: Record<string, string>, subject: string): boolean {
  // RFC 3834 — Auto-Submitted header
  const autoSubmitted = (headers["auto-submitted"] ?? "").toLowerCase().trim();
  if (autoSubmitted && autoSubmitted !== "no") return true;

  // Microsoft / Exchange suppress header
  if (headers["x-auto-response-suppress"]) return true;

  // Mailing-list / bulk precedence
  const precedence = (headers["precedence"] ?? "").toLowerCase().trim();
  if (["auto-reply", "bulk", "junk", "list"].includes(precedence)) return true;

  // Subject-based patterns (PEC notifications, bounce messages, OOO)
  const subj = subject.toLowerCase();
  const AUTO_SUBJECT_PATTERNS = [
    "messaggio pec inoltrato",
    "anomalia messaggio",
    "avvenuta consegna",
    "presa in carico",
    "ricevuta di accettazione",
    "ricevuta di avvenuta",
    "posta certificata",
    "undeliverable",
    "delivery failed",
    "delivery status notification",
    "mail delivery failed",
    "non-delivery report",
    "failure notice",
    "automatic reply",
    "auto: ",
    "out of office",
    "fuori ufficio",
    "risposta automatica",
    "mailer-daemon",
  ];
  if (AUTO_SUBJECT_PATTERNS.some((p) => subj.includes(p))) return true;

  return false;
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
    hasProviderAttachments: Array.isArray(body?.attachments) ? body.attachments.length : 0,
  }, "Inbound email webhook received");

  // Extract sender — handle "Name <email>" format
  const rawFrom = extractField(body, "from", "from_email", "sender_email", "From");
  const { email: fromEmail, name: fromNameParsed } = parseEmailAddress(rawFrom);
  const fromName = extractField(body, "from_name", "sender_name", "name") || fromNameParsed || fromEmail;
  const subject = extractField(body, "subject", "Subject") || "Support request";

  const { text: bodyText, attachments, overrideSubject, discard } = extractTextAndAttachments(body);

  if (discard) {
    req.log.info({ from: fromEmail }, "Inbound email: PEC receipt discarded silently");
    res.status(200).json({ ok: true });
    return;
  }

  const effectiveSubject = overrideSubject || subject;

  req.log.info(
    { attachmentCount: attachments.length, oversized: attachments.filter(a => a.oversized).length, isPec: !!overrideSubject },
    "Inbound email: extracted attachments",
  );

  // Email headers for threading
  const headers: Record<string, string> = body?.headers ?? {};
  const messageId = extractField(body, "messageId", "message_id", "MessageID") || headers["message-id"] || headers["Message-ID"] || "";
  const inReplyTo = extractField(body, "inReplyTo", "in_reply_to", "InReplyTo") || headers["in-reply-to"] || headers["In-Reply-To"] || "";
  const references = extractField(body, "references", "References") || headers["references"] || headers["References"] || "";

  // Auto-reply / automated sender detection — discard before creating a ticket
  if (isAutoReply(headers, effectiveSubject)) {
    req.log.info({ from: fromEmail, subject: effectiveSubject }, "Inbound email: auto-reply/automated message discarded");
    res.status(200).json({ ok: true });
    return;
  }

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
      subject: effectiveSubject,
      bodyText,
      attachments,
      orgId: resolvedOrgId,
      messageId: messageId || undefined,
      inReplyTo: inReplyTo || undefined,
      references: references || undefined,
      inboundChannelId: resolvedChannelId,
      isPec: !!overrideSubject,
    });
    req.log.info({ from: fromEmail, orgId: resolvedOrgId, inboundChannelId: resolvedChannelId }, "Inbound email processed successfully");
    res.status(200).json({ ok: true });
  } catch (err: any) {
    req.log.error({ err }, "Failed to process inbound email webhook");
    res.status(500).json({ error: err?.message ?? "Internal error" });
  }
});

export default router;
