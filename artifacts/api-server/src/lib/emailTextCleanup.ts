const FORWARDED_MARKER =
  /^\s*(?:-{2,}\s*(?:forwarded message|messaggio inoltrato|messaggio originale|original message)\s*-{2,}|begin forwarded message:|inizio messaggio inoltrato:)\s*$/im;

const FORWARDED_HEADER =
  /^\s*(?:from|da|sent|inviato|date|data|to|a|cc|bcc|subject|oggetto|reply-to|rispondi a)\s*:/i;

/**
 * Removes the metadata block inserted by common mail clients when forwarding
 * an email, while retaining any note written above the forward and the actual
 * forwarded message. Unknown formats are returned unchanged.
 */
export function cleanForwardedEmailBody(body: string): string {
  const normalized = body.replace(/\r\n?/g, "\n").trim();
  if (!normalized) return "";

  const marker = FORWARDED_MARKER.exec(normalized);
  const headerStart = marker ? marker.index + marker[0].length : 0;
  const prefix = marker ? normalized.slice(0, marker.index).trim() : "";
  const lines = normalized.slice(headerStart).split("\n");

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

  const forwardedContent = lines.slice(bodyStart).join("\n").trim();
  if (!forwardedContent) return normalized;

  return [prefix, forwardedContent]
    .filter(Boolean)
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
