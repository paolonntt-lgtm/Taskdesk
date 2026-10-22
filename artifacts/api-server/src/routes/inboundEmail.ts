import { Router, type IRouter } from "express";
import { timingSafeEqual } from "crypto";
import { eq } from "drizzle-orm";
import { db, inboundEmailChannelsTable } from "@workspace/db";
import { processInboundEmail } from "../lib/ticketFromEmail";
import { inboundEmailRateLimiter } from "../lib/rateLimiter";
import type { InboundAttachment } from "../lib/ticketFromEmail";
import {
  MAX_ATTACHMENT_BYTES,
  isMimeAllowed,
  parseMimeMessage,
  decodeBodyText,
  decodeBodyBuffer,
  decodeMimeWords,
  tryUnwrapPec,
  cleanPecSubject,
} from "../lib/pecUtils";
import {
  extractForwardedSender,
  extractSenderFromRawEmail,
  extractSenderFromEmbeddedEmail,
  extractSenderFromProviderAttachments,
} from "../lib/forwardedEmailSender";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Webhook payload helpers
// ---------------------------------------------------------------------------

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

/**
 * Detects automated / auto-reply messages that should never create a ticket.
 * Checks RFC-standard headers, common mailer patterns, and PEC-specific subjects.
 *
 * @param headers   - Email headers from the webhook payload.
 * @param subject   - Effective (inner) subject after PEC extraction.
 * @param outerSubject - Raw outer PEC envelope subject (before extraction), when available.
 */
function isAutoReply(
  headers: Record<string, string>,
  subject: string,
  outerSubject?: string,
): boolean {
  // RFC 3834 — Auto-Submitted header
  const autoSubmitted = (headers["auto-submitted"] ?? "").toLowerCase().trim();
  if (autoSubmitted && autoSubmitted !== "no") return true;

  // Microsoft / Exchange suppress header
  if (headers["x-auto-response-suppress"]) return true;

  // Mailing-list / bulk precedence
  const precedence = (headers["precedence"] ?? "").toLowerCase().trim();
  if (["auto-reply", "bulk", "junk", "list"].includes(precedence)) return true;

  // TaskDesk-specific bounce detection: the outer PEC envelope subject contains
  // "Richiesta #N risolta" or the ✅ emoji when the PEC system wraps one of our
  // own outgoing "ticket resolved" notifications and bounces it back as inbound.
  // We check the outer subject here because extractTextAndAttachments may have
  // replaced the effective subject with the inner (still-encoded) PEC content.
  const envelopeSubject = outerSubject ?? subject;
  if (/richiesta\s*#\d+\s*risolta/i.test(envelopeSubject)) return true;
  if (/\u2705/.test(envelopeSubject) && /risolta/i.test(envelopeSubject)) return true;

  // Subject-based patterns for genuine auto-replies, bounce messages, and
  // specific PEC receipt types that are always system-generated.
  // NOTE: broad PEC patterns like "messaggio pec inoltrato", "anomalia messaggio",
  // and "posta certificata" are intentionally omitted here — the legalmail.it PEC
  // provider uses these as envelope wrappers for ALL forwarded messages (including
  // legitimate business emails such as bank payment notifications), so matching on
  // them would silently discard valid inbound email.
  const subj = subject.toLowerCase();
  const AUTO_SUBJECT_PATTERNS = [
    "avvenuta consegna",
    "presa in carico",
    "ricevuta di accettazione",
    "ricevuta di avvenuta",
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

/**
 * Extracts plain text and attachment list from a webhook payload.
 * Tries provider-supplied parsed fields first, then falls back to raw MIME parsing.
 * Handles PEC (Posta Elettronica Certificata) envelopes transparently.
 */
function extractTextAndAttachments(body: any): {
  text: string;
  attachments: InboundAttachment[];
  overrideSubject?: string;
  originalSenderEmail?: string;
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
      originalSenderEmail:
        extractSenderFromRawEmail(`From: ${pecResult.originalSenderEmail ?? ""}\r\n\r\n`) ??
        extractForwardedSender(pecResult.text) ??
        undefined,
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
    return {
      text: providerText,
      attachments,
      originalSenderEmail:
        extractForwardedSender(providerText) ??
        extractSenderFromEmbeddedEmail(rawMime) ??
        extractSenderFromProviderAttachments(providerAttachments) ??
        undefined,
    };
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
    return {
      text: text || rawMime,
      attachments,
      originalSenderEmail: extractForwardedSender(text) ?? extractSenderFromEmbeddedEmail(rawMime) ?? undefined,
    };
  }

  return { text: "", attachments: [] };
}

router.post("/inbound-email", inboundEmailRateLimiter, async (req, res): Promise<void> => {
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

  // Use timing-safe comparison to prevent character-by-character timing oracle.
  // Both buffers must be the same length; if not, the token is definitively wrong.
  const expectedBuf = Buffer.from(expectedToken, "utf8");
  const receivedBuf = Buffer.from(receivedToken, "utf8");
  const tokenValid =
    expectedBuf.length === receivedBuf.length &&
    timingSafeEqual(expectedBuf, receivedBuf);

  if (!tokenValid) {
    req.log.warn({ raw: rawToken }, "Invalid inbound email token");
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const body = req.body;

  // Log the raw payload structure for debugging (no sensitive content)
  const rawMimeForLog: string = (body?.body || body?.rawMail || "").trim();
  const headersForLog: Record<string, string> = (body?.headers && typeof body.headers === "object")
    ? body.headers as Record<string, string>
    : {};
  const xTrasportoLog = Object.entries(headersForLog)
    .find(([k]) => k.toLowerCase() === "x-trasporto")?.[1] ?? "(absent)";
  // Also peek at X-Trasporto from the raw MIME headers
  let mimeXTrasportoLog = "(absent)";
  if (rawMimeForLog) {
    const blankIdx = rawMimeForLog.search(/\r?\n\r?\n/);
    if (blankIdx !== -1) {
      const mimeHdrs = rawMimeForLog.slice(0, blankIdx);
      const m = /^x-trasporto:\s*(.+)$/im.exec(mimeHdrs);
      if (m) mimeXTrasportoLog = m[1].trim();
    }
  }
  req.log.info({
    bodyKeys: body ? Object.keys(body) : [],
    toRaw: body?.to ?? body?.To ?? body?.ToFull ?? body?.envelope?.to ?? "(missing)",
    fromRaw: body?.from ?? body?.From ?? body?.from_email ?? "(missing)",
    subject: body?.subject ?? body?.Subject ?? "(missing)",
    hasText: !!(body?.text || body?.body_text || body?.plain || body?.body),
    hasHeaders: !!body?.headers,
    hasProviderAttachments: Array.isArray(body?.attachments) ? body.attachments.length : 0,
    xTrasportoProvider: xTrasportoLog,
    xTrasportoMime: mimeXTrasportoLog,
    rawMimeBytes: rawMimeForLog.length,
  }, "Inbound email webhook received");

  // Extract sender — handle "Name <email>" format
  const rawFrom = extractField(body, "from", "from_email", "sender_email", "From");
  const { email: fromEmail, name: fromNameParsed } = parseEmailAddress(rawFrom);
  const fromName = extractField(body, "from_name", "sender_name", "name") || fromNameParsed || fromEmail;
  const subject = decodeMimeWords(extractField(body, "subject", "Subject") || "Support request");

  const { text: bodyText, attachments, overrideSubject, originalSenderEmail, discard } = extractTextAndAttachments(body);

  if (discard) {
    req.log.info({ from: fromEmail }, "Inbound email: PEC receipt discarded silently");
    res.status(200).json({ ok: true });
    return;
  }

  // Apply PEC subject cleaning even when the inner subject wasn't extracted
  // (e.g. legalmail ANOMALIA MESSAGGIO without postacert.eml): strips prefixes
  // like "POSTA CERTIFICATA:", "Messaggio PEC inoltrato", "[ANOMALIA MESSAGGIO: …]"
  const effectiveSubject = overrideSubject || cleanPecSubject(subject);

  req.log.info(
    { attachmentCount: attachments.length, oversized: attachments.filter(a => a.oversized).length, isPec: !!overrideSubject },
    "Inbound email: extracted attachments",
  );

  // Email headers for threading
  const headers: Record<string, string> = body?.headers ?? {};
  const messageId = extractField(body, "messageId", "message_id", "MessageID") || headers["message-id"] || headers["Message-ID"] || "";
  const inReplyTo = extractField(body, "inReplyTo", "in_reply_to", "InReplyTo") || headers["in-reply-to"] || headers["In-Reply-To"] || "";
  const references = extractField(body, "references", "References") || headers["references"] || headers["References"] || "";

  // Auto-reply / automated sender detection — discard before creating a ticket.
  // Pass the outer PEC envelope subject (subject) separately from the effective
  // inner subject (effectiveSubject) so isAutoReply can apply the right checks
  // to each: TaskDesk bounce detection on the envelope, general patterns on the
  // inner content.
  if (isAutoReply(headers, effectiveSubject, subject)) {
    req.log.info({ from: fromEmail, subject: effectiveSubject, outerSubject: subject }, "Inbound email: auto-reply/automated message discarded");
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
      originalSenderEmail,
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
