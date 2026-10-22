import { decodeBodyText, parseHeaders, parseMimeMessage } from "./pecUtils";
import { normalizeSenderEmail } from "./emailClientAssociation";

function validatedSender(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const match = /^(.+?)\s*<([^>]+)>\s*$/.exec(raw.trim());
  return normalizeSenderEmail(match?.[2] ?? raw);
}

export function extractSenderFromRawEmail(rawEmail: string): string | null {
  const separator = rawEmail.search(/\r?\n\r?\n/);
  if (separator < 0) return null;
  const headers = parseHeaders(rawEmail.slice(0, separator));
  return validatedSender(headers.from);
}

export function extractForwardedSender(text: string): string | null {
  const marker = /(?:^|\n)\s*(?:-{2,}\s*(?:forwarded message|original message|messaggio inoltrato|messaggio originale)\s*-{2,}|begin forwarded message:|inizio messaggio inoltrato:)\s*(?:\r?\n)/ig;
  const match = marker.exec(text);
  if (!match) return null;
  const forwardedBlock = text.slice(marker.lastIndex, marker.lastIndex + 5000);
  const fromLine = /^(?:from|da):\s*(.+)$/im.exec(forwardedBlock);
  return fromLine ? validatedSender(fromLine[1]) : null;
}

export function extractSenderFromEmbeddedEmail(rawMime: string): string | null {
  if (!rawMime) return null;
  const { rawAttachments } = parseMimeMessage(rawMime);
  for (const attachment of rawAttachments) {
    if (attachment.mimeType !== "message/rfc822" && !attachment.filename.toLowerCase().endsWith(".eml")) continue;
    const sender = extractSenderFromRawEmail(decodeBodyText(attachment.rawBody, attachment.encoding));
    if (sender) return sender;
  }
  return null;
}

export function extractSenderFromProviderAttachments(attachments: any[]): string | null {
  for (const attachment of attachments) {
    const filename = String(attachment?.filename || attachment?.name || attachment?.FileName || "").toLowerCase();
    const mimeType = String(attachment?.content_type || attachment?.ContentType || attachment?.type || "").toLowerCase();
    if (!filename.endsWith(".eml") && mimeType !== "message/rfc822") continue;
    const content = attachment?.content || attachment?.data || attachment?.Content || "";
    if (typeof content !== "string" || !content) continue;
    const sender = extractSenderFromRawEmail(Buffer.from(content.replace(/\s/g, ""), "base64").toString("utf8"));
    if (sender) return sender;
  }
  return null;
}
