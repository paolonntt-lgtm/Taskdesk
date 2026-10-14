const FORWARDED_MARKER =
  /^\s*(?:-{2,}\s*(?:forwarded message|messaggio inoltrato|messaggio originale|original message)\s*-{2,}|begin forwarded message:|inizio messaggio inoltrato:)(.*)$/im;

const FORWARDED_HEADER =
  /^\s*(?:from|da|sent|inviato|date|data|to|a|cc|bcc|subject|oggetto|reply-to|rispondi a)\s*:/i;

const INLINE_HEADER_FIELDS =
  /\b(?:from|da|sent|inviato|date|data|to|a|cc|bcc|subject|oggetto|reply-to|rispondi a)\s*:/gi;

const SIGN_OFF = /\b(?:cordiali saluti|saluti cordiali|distinti saluti|un cordiale saluto|un saluto|cordialmente|a presto|best regards|kind regards|regards|thank you|thanks)[.!]?\s*$/i;
const SIGNATURE_CONTACT_OR_FOOTER =
  /(?:[\w.+-]+@[\w.-]+\.[a-z]{2,}|https?:\/\/|www\.|(?:cell|tel(?:efono)?|mobile|phone|fax|pec)\s*[:.+-]?|\+?\d[\d\s()./-]{7,}|privacy|riservat|confidential|gdpr|please consider|non rispondere)/i;

function removeForwardedSignatureAndOlderReplies(body: string): string {
  const cutoffPatterns = [
    // Standard signature delimiter used by many mail clients.
    /^\s*--\s*$/m,
    // Outlook/Gmail quoted message headers sometimes arrive as one long line.
    /^\s*(?:Da|From):[^\n]*(?:Inviato|Sent|Oggetto|Subject)\s*:/im,
    /^\s*(?:Il giorno .{5,200}ha scritto:|On .{5,200}wrote:)\s*$/im,
  ];

  let cutoff = body.length;
  for (const pattern of cutoffPatterns) {
    const match = pattern.exec(body);
    if (match && match.index < cutoff) cutoff = match.index;
  }

  return body.slice(0, cutoff).trim();
}

function keepNameAndRoleOnly(body: string): string {
  const lines = body.split("\n");
  let signOffIndex = -1;

  for (let index = 0; index < lines.length; index++) {
    if (SIGN_OFF.test(lines[index].trim())) signOffIndex = index;
  }

  // Without a clear closing line, preserve the content rather than guessing
  // where the message ends and the signature begins.
  if (signOffIndex < 0) return body;

  const signatureLines: string[] = [];
  for (const line of lines.slice(signOffIndex + 1)) {
    const cleaned = line.replace(/^\s*\*+|\*+\s*$/g, "").trim();
    if (!cleaned || SIGNATURE_CONTACT_OR_FOOTER.test(cleaned)) continue;
    signatureLines.push(cleaned);
    if (signatureLines.length === 2) break;
  }

  return [
    ...lines.slice(0, signOffIndex + 1),
    ...(signatureLines.length ? ["", ...signatureLines] : []),
  ].join("\n").trim();
}

/**
 * Removes the metadata block inserted by common mail clients when forwarding
 * an email, while retaining any note written above the forward and the actual
 * forwarded message. Unknown formats are returned unchanged.
 */
export function cleanForwardedEmailBody(body: string): string {
  const normalized = body.replace(/\r\n?/g, "\n").trim();
  if (!normalized) return "";

  const marker = FORWARDED_MARKER.exec(normalized);
  const markerRemainder = marker?.[1]?.trim() ?? "";
  const headerStart = marker ? marker.index + marker[0].length : 0;
  const prefix = marker ? normalized.slice(0, marker.index).trim() : "";
  const remainder = normalized.slice(headerStart);

  // Some providers flatten the forwarding marker and all its headers onto one
  // line (e.g. "Forwarded message — Da: ... Date: ... Subject: ... To: ...").
  // Only treat that line as metadata when it contains multiple known fields.
  if (marker && markerRemainder) {
    const inlineFields = markerRemainder.match(INLINE_HEADER_FIELDS) ?? [];
    if (inlineFields.length >= 2) {
      const forwardedContent = keepNameAndRoleOnly(
        removeForwardedSignatureAndOlderReplies(remainder),
      );
      if (!forwardedContent) return normalized;
      return [prefix, forwardedContent]
        .filter(Boolean)
        .join("\n\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    }
  }

  const lines = [
    ...(markerRemainder ? [markerRemainder] : []),
    ...remainder.split("\n"),
  ];

  let index = 0;
  while (index < lines.length && !lines[index].trim()) index++;

  let headerCount = 0;
  let previousWasHeader = false;
  let bodyStart = -1;

  for (; index < lines.length; index++) {
    const line = lines[index];
    if (!line.trim()) {
      if (headerCount >= 2) {
        bodyStart = index + 1;
        break;
      }
      continue;
    }

    if (FORWARDED_HEADER.test(line)) {
      headerCount++;
      previousWasHeader = true;
      continue;
    }

    // Folded email-header continuation lines are part of the metadata block.
    if (/^\s+/.test(line) && previousWasHeader) continue;

    // A non-header line before a complete header block means this format is
    // ambiguous. Fail open rather than risk deleting useful message content.
    return normalized;
  }

  if (headerCount < 2 || bodyStart < 0) return normalized;

  const forwardedContent = keepNameAndRoleOnly(
    removeForwardedSignatureAndOlderReplies(lines.slice(bodyStart).join("\n").trim()),
  );
  if (!forwardedContent) return normalized;

  return [prefix, forwardedContent]
    .filter(Boolean)
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
