/**
 * PEC (Posta Elettronica Certificata) parsing and unwrapping utilities.
 *
 * These functions are kept in a standalone module (no Express / DB imports) so
 * they can be unit-tested independently.
 */

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export const ALLOWED_MIME_PREFIXES = [
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

export function isMimeAllowed(mimeType: string): boolean {
  const mt = mimeType.toLowerCase().split(";")[0].trim();
  return ALLOWED_MIME_PREFIXES.some((p) => mt.startsWith(p));
}

// ---------------------------------------------------------------------------
// MIME parsing helpers
// ---------------------------------------------------------------------------

export function parseHeaders(headerBlock: string): Record<string, string> {
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

export function extractBoundary(contentType: string): string | null {
  const m = /boundary="?([^";]+)"?/i.exec(contentType);
  return m ? m[1].trim() : null;
}

export function decodeQuotedPrintable(input: string): string {
  return input
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

export function decodeBodyText(raw: string, encoding: string): string {
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

export function decodeBodyBuffer(raw: string, encoding: string): Buffer {
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

export function extractFilename(headerValue: string): string {
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

export interface RawAttachment {
  filename: string;
  mimeType: string;
  rawBody: string;
  encoding: string;
}

interface CollectedData {
  textParts: string[];
  htmlParts: string[];
  attachments: RawAttachment[];
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
export function parseMimeMessage(raw: string): { text: string; rawAttachments: RawAttachment[] } {
  const out: CollectedData = { textParts: [], htmlParts: [], attachments: [] };

  const blankIdx = raw.search(/\r?\n\r?\n/);
  if (blankIdx !== -1 && /^[\w-]+:/m.test(raw.slice(0, blankIdx))) {
    const headerBlock = raw.slice(0, blankIdx);
    const body = raw.slice(blankIdx + 1).replace(/^\r?\n/, "");
    const headers = parseHeaders(headerBlock);
    collectRecursive(headers, body, out);
  } else {
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

/**
 * Decodes MIME encoded-words (RFC 2047) found in email subjects.
 * Handles Q (quoted-printable) and B (base64) encodings.
 * Multiple adjacent encoded-words are concatenated without the separating whitespace.
 */
export function decodeMimeWords(input: string): string {
  const re = /=\?([^?]+)\?([BQbq])\?([^?]*)\?=/g;
  let result = input;
  const hasEncoded = re.test(input);
  if (!hasEncoded) return input;

  const collapsed = input.replace(/(=\?[^?]+\?[BQbq]\?[^?]*\?=)\s+(=\?[^?]+\?[BQbq]\?[^?]*\?=)/g, "$1$2");
  re.lastIndex = 0;

  result = collapsed.replace(/=\?([^?]+)\?([BQbq])\?([^?]*)\?=/g, (_, _charset, enc, encoded) => {
    try {
      if (enc.toUpperCase() === "Q") {
        const raw = encoded.replace(/_/g, " ").replace(/=([0-9A-Fa-f]{2})/g, (_m: string, hex: string) =>
          String.fromCharCode(parseInt(hex, 16))
        );
        return Buffer.from(raw, "binary").toString("utf8");
      }
      return Buffer.from(encoded, "base64").toString("utf8");
    } catch {
      return encoded;
    }
  });
  return result.trim();
}

// ---------------------------------------------------------------------------
// PEC-specific helpers
// ---------------------------------------------------------------------------

export interface InboundAttachment {
  filename: string;
  mimeType: string;
  data: Buffer;
  oversized: boolean;
}

export type PecUnwrapResult =
  | { isPec: false }
  | { isPec: true; isReceipt: true }
  | { isPec: true; isReceipt: false; text: string; attachments: InboundAttachment[]; subject: string | null };

/**
 * Strips PEC infrastructure subject prefixes from a subject string.
 *
 * legalmail.it (and similar PEC gateways) prepend several fixed prefixes when
 * forwarding non-PEC mail through a PEC inbox:
 *   - "POSTA CERTIFICATA: <original subject>"
 *   - "ACCETTAZIONE: <original subject>"
 *   - "Messaggio PEC inoltrato [ANOMALIA MESSAGGIO: <desc>] <original subject>"
 *
 * The function removes all such prefixes iteratively until none remain, then
 * returns the clean original subject.
 */
export function cleanPecSubject(subject: string): string {
  let s = subject.trim();
  let prev: string;
  do {
    prev = s;
    s = s.replace(/^POSTA CERTIFICATA:\s*/i, "");
    s = s.replace(/^ACCETTAZIONE:\s*/i, "");
    s = s.replace(/^Messaggio PEC inoltrato\s*/i, "");
    s = s.replace(/^\[ANOMALIA MESSAGGIO:[^\]]*\]\s*/i, "");
    s = s.trim();
  } while (s !== prev);
  return s;
}

/**
 * Recursively unwraps nested PEC postacert.eml attachments.
 *
 * legalmail.it double-wraps forwarded non-PEC messages: the outer PEC envelope
 * contains a postacert.eml which itself contains another postacert.eml with
 * the real original message. This function recursively follows the chain up to
 * `maxDepth` levels and returns the innermost non-PEC payload.
 *
 * Returns null when no postacert.eml is found at the current level.
 */
function unwrapPostacertChain(
  rawMime: string,
  depth: number,
  maxDepth: number,
): { text: string; rawAttachments: RawAttachment[]; subject: string | null } | null {
  if (depth > maxDepth) return null;

  const { rawAttachments } = parseMimeMessage(rawMime);

  const postacertPart = rawAttachments.find(
    (a) =>
      a.filename.toLowerCase() === "postacert.eml" &&
      (a.mimeType === "message/rfc822" || a.mimeType === "application/octet-stream"),
  );

  if (!postacertPart) return null;

  const postacertRaw = decodeBodyText(postacertPart.rawBody, postacertPart.encoding);

  // Recurse first: if the inner content is itself a PEC envelope, go deeper
  const deeper = unwrapPostacertChain(postacertRaw, depth + 1, maxDepth);
  if (deeper) return deeper;

  // Innermost level — extract subject and content from this postacert.eml
  let innerSubject: string | null = null;
  const innerBlankIdx = postacertRaw.search(/\r?\n\r?\n/);
  if (innerBlankIdx !== -1) {
    const innerHeaders = parseHeaders(postacertRaw.slice(0, innerBlankIdx));
    innerSubject = innerHeaders["subject"]?.trim() || null;
  }

  const { text: innerText, rawAttachments: innerRawAttachments } = parseMimeMessage(postacertRaw);

  return { text: innerText, rawAttachments: innerRawAttachments, subject: innerSubject };
}

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
 * postacert.eml, recursively unwrapping nested PEC envelopes (legalmail "inoltro"
 * double-wrapping), and returns the real body text, subject, and attachments.
 * The subject is cleaned of PEC infrastructure prefixes before being returned.
 */
export function tryUnwrapPec(
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
  let mimeRawAttachments: RawAttachment[] = [];
  if (rawMime) {
    const { rawAttachments } = parseMimeMessage(rawMime);
    mimeRawAttachments = rawAttachments;
  }

  // Require both the correct filename AND a compatible MIME type to avoid
  // false-positive matches against other embedded RFC 822 messages (e.g. forwarded emails).
  const hasPostacertPart = mimeRawAttachments.some(
    (a) =>
      a.filename.toLowerCase() === "postacert.eml" &&
      (a.mimeType === "message/rfc822" || a.mimeType === "application/octet-stream"),
  );
  const hasDaticertXml = mimeRawAttachments.some(
    (a) => a.filename.toLowerCase() === "daticert.xml",
  );

  if (!isPecByHeader && !hasPostacertPart && !hasDaticertXml) {
    return { isPec: false };
  }

  // PEC envelope detected — recursively unwrap postacert.eml chain (up to 3 levels)
  const unwrapped = unwrapPostacertChain(rawMime, 0, 3);
  if (!unwrapped) {
    // PEC signals present but no postacert.eml to unwrap — fall through
    return { isPec: false };
  }

  // Decode and clean the subject
  const rawSubject = unwrapped.subject ? decodeMimeWords(unwrapped.subject) : null;
  const innerSubject = rawSubject ? cleanPecSubject(rawSubject) : null;

  // Build final attachments: skip PEC infrastructure files
  const innerAttachments: InboundAttachment[] = [];
  for (const ra of unwrapped.rawAttachments) {
    if (ra.filename.toLowerCase() === "daticert.xml") continue;
    if (ra.filename.toLowerCase() === "postacert.eml") continue;
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

  return { isPec: true, isReceipt: false, text: unwrapped.text, attachments: innerAttachments, subject: innerSubject };
}
