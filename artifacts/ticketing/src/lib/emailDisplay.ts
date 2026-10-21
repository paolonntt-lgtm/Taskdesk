export interface EmailBodySections {
  metadata: string;
  message: string;
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

  const signOff = /\b(?:cordiali saluti|saluti cordiali|distinti saluti|un cordiale saluto|un saluto|cordialmente|a presto|best regards|kind regards|regards|thank you|thanks)[.,!?]?\s*$/i;
  const signOffIndex = bodyLines.findIndex((line) => signOff.test(line.trim()));
  const quotedDetails = quotedLines.join("\n").trim();

  if (signOffIndex < 0) {
    return {
      metadata,
      message: bodyLines.join("\n").trim(),
      details: quotedDetails,
    };
  }

  return {
    metadata,
    message: bodyLines.slice(0, signOffIndex + 1).join("\n").trim(),
    details: [bodyLines.slice(signOffIndex + 1).join("\n").trim(), quotedDetails]
      .filter(Boolean)
      .join("\n"),
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
