export interface EmailBodySections {
  metadata: string;
  message: string;
  signature: string;
  details: string;
}

export interface QuotedEmail {
  header: string;
  body: string;
}

export interface EmailThreadDetails {
  signatureAndFooter: string;
  quotedEmails: QuotedEmail[];
}

const QUOTED_EMAIL_HEADER =
  /^(?:da|from):\s*.+|il .+ ha scritto:\s*|on .+ wrote:\s*|--+\s*(?:messaggio originale|original message)\s*--+$/i;

const SIGN_OFF_PATTERN =
  /(?:cordiali saluti|saluti cordiali|distinti saluti|un cordiale saluto|un saluto|cordialmente|a presto|best regards|kind regards|regards|thank you|thanks)[.,!?]?\s*$/i;

const SIGNATURE_MARKER_PATTERN =
  /(?:\b(?:tel|telefono|cell|mobile|phone|fax)\b\s*[:.]?\s*\+?\d|(?:\+?\d(?:[\s()./-]*\d){7,})|[\w.+-]+@[\w.-]+\.[a-z]{2,}|\b(?:privacy|riservatezza|confidentiality|confidential|informativa sulla privacy)\b)/i;

const SIGNATURE_ROLE_LINE_PATTERN =
  /^\s*(?:(?:[\p{L}'’.-]+\s+){0,3})(?:consulente del lavoro|avvocato|commercialista|notaio|operations manager|manager|director|partner|accountant)\s*$/imu;

const MOBILE_SIGNATURE_PATTERN =
  /^\s*(?:sent from my (?:iphone|ipad|android|phone|mobile device)|inviato dal mio (?:iphone|ipad|android|telefono|dispositivo mobile))\s*[.!]?\s*$/i;

function looksLikeSignatureTail(text: string): boolean {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return false;
  if (SIGNATURE_MARKER_PATTERN.test(text) || SIGNATURE_ROLE_LINE_PATTERN.test(text)) return true;
  if (lines.length > 3) return false;
  return lines.every((line) =>
    line.length <= 80 &&
    !/[.!?]/.test(line) &&
    /^[A-ZÀ-ÖØ-Þ][\p{L}'’.-]*(?:\s+[A-ZÀ-ÖØ-Þ][\p{L}'’.-]*){0,5}$/u.test(line),
  );
}

function normalizeQuotedEmailHeader(line: string): string {
  return line
    .trim()
    .replace(/^(?:>\s*)+/, "")
    .replace(/^[*_`\s]+/, "")
    .replace(/[*_`]+$/, "")
    .trim();
}

function isQuotedEmailHeader(line: string): boolean {
  return QUOTED_EMAIL_HEADER.test(normalizeQuotedEmailHeader(line));
}

export function splitEmailThreadDetails(details: string): EmailThreadDetails {
  const signatureLines: string[] = [];
  const quotedEmails: QuotedEmail[] = [];
  let currentHeader: string | null = null;
  let currentBody: string[] = [];

  for (const line of details.replace(/\r\n?/g, "\n").split("\n")) {
    if (isQuotedEmailHeader(line)) {
      if (currentHeader !== null) {
        quotedEmails.push({ header: currentHeader, body: currentBody.join("\n").trim() });
      }
      currentHeader = normalizeQuotedEmailHeader(line);
      currentBody = [];
    } else if (currentHeader !== null) {
      // Each quoted email is rendered in its own block, so retaining the
      // mail client's nested `>` prefixes would make long threads too narrow.
      currentBody.push(line.replace(/^\s*(?:>\s*)+/, ""));
    } else {
      signatureLines.push(line);
    }
  }

  if (currentHeader !== null) {
    quotedEmails.push({ header: currentHeader, body: currentBody.join("\n").trim() });
  }

  return {
    signatureAndFooter: signatureLines.join("\n").trim(),
    quotedEmails,
  };
}

export function splitEmailBodySections(text: string): EmailBodySections {
  const normalized = text.replace(/\r\n?/g, "\n").trim();
  const lines = normalized.split("\n");
  const firstBlank = lines.findIndex((line) => !line.trim());
  let metadata = "";
  let bodyLines = lines;

  if (firstBlank > 0 && firstBlank <= 8) {
    const possibleHeader = lines.slice(0, firstBlank);
    const headerText = possibleHeader.join("\n");
    const startsLikeHeader =
      /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(possibleHeader[0]) ||
      /^\s*(?:-{2,}\s*(?:forwarded|messaggio|original message)|begin forwarded message)/i.test(possibleHeader[0]);
    const headerFields = headerText.match(
      /\b(?:tramite|via|from|da|date|data|sent|inviato|subject|oggetto)\b|(?:\bto\b|\ba\b)\s*:|(?:\bto\b|\ba\b)\s+[\w.+-]+@|(?:lun|mar|mer|gio|ven|sab|dom)\s+\d{1,2}\s+(?:gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic)/gi,
    ) ?? [];

    if (startsLikeHeader && headerFields.length >= 2) {
      metadata = possibleHeader.join("\n").trim();
      bodyLines = lines.slice(firstBlank + 1);
    }
  }

  // Some mail clients put the closing phrase on the same line as the message
  // (for example, "Sì, ... Buona giornata AV"). In that case a sign-off-only
  // split misses the entire quoted chain. Find the first quoted-message header
  // independently, then keep everything after it in the details section.
  const firstQuotedHeader = bodyLines.findIndex(isQuotedEmailHeader);
  const quotedLines = firstQuotedHeader >= 0 ? bodyLines.slice(firstQuotedHeader) : [];
  if (firstQuotedHeader >= 0) {
    bodyLines = bodyLines.slice(0, firstQuotedHeader);
  }

  const quotedDetails = quotedLines.join("\n").trim();

  // Hide only a clearly marked sign-off or a signature separator followed by
  // recognizable contact/footer text. Ambiguous trailing text stays visible.
  let signatureStart = -1;
  let signOffMatch: RegExpMatchArray | null = null;
  const mobileSignatureIndex = bodyLines.findIndex(
    (line, index) => index >= Math.max(0, bodyLines.length - 3) && MOBILE_SIGNATURE_PATTERN.test(line),
  );
  if (mobileSignatureIndex >= 0) signatureStart = mobileSignatureIndex;

  for (let index = Math.max(0, bodyLines.length - 12); signatureStart < 0 && index < bodyLines.length; index += 1) {
    const match = bodyLines[index].match(SIGN_OFF_PATTERN);
    if (!match) continue;

    const beforeSignOff = bodyLines[index].slice(0, match.index ?? 0).trim();
    const followingText = bodyLines.slice(index + 1).join("\n").trim();
    if (
      (!beforeSignOff && !followingText) ||
      (followingText && looksLikeSignatureTail(followingText))
    ) {
      signatureStart = index;
      signOffMatch = match;
      break;
    }
  }

  if (signatureStart < 0) {
    const separatorIndex = bodyLines.findIndex((line) => /^\s*--\s*$/.test(line));
    if (separatorIndex >= 0) {
      const tail = bodyLines.slice(separatorIndex + 1).join("\n").trim();
      if (tail && SIGNATURE_MARKER_PATTERN.test(tail)) signatureStart = separatorIndex;
    }
  }

  let messageLines = bodyLines;
  let signature = "";
  if (signatureStart >= 0) {
    const signatureLines = bodyLines.slice(signatureStart);
    if (signOffMatch) {
      const line = bodyLines[signatureStart];
      const signOffOffset = signOffMatch.index ?? 0;
      const messagePrefix = line.slice(0, signOffOffset).trimEnd();
      signatureLines[0] = line.slice(signOffOffset).trim();
      messageLines = bodyLines.slice(0, signatureStart);
      if (messagePrefix) messageLines.push(messagePrefix);
    } else {
      messageLines = bodyLines.slice(0, signatureStart);
    }
    signature = signatureLines.join("\n").trim();
  }

  return {
    metadata,
    message: messageLines.join("\n").trim(),
    signature,
    details: quotedDetails,
  };
}

export function compactEmailDetailLinks(text: string): string {
  const protectedSegments: string[] = [];
  let result = text.replace(/(`[^`]*`|\[[^\]]+\]\([^)]+\))/g, (segment) => {
    const index = protectedSegments.push(segment) - 1;
    return `\u0000${index}\u0000`;
  });

  result = result.replace(
    /<\s*(https?:\/\/[^>\s]+)\s*>|https?:\/\/[^\s<>"'`)\]]+/gi,
    (match, angleUrl: string | undefined) => {
      const url = angleUrl ?? match;
      const label = /google\.[^/]+\/maps/i.test(url) ? 'mappa' : 'link';
      return `[${label}](${url})`;
    },
  );

  return result.replace(/\u0000(\d+)\u0000/g, (_match, index: string) => protectedSegments[Number(index)]);
}
