import { domainToASCII } from "node:url";

export interface EmailClientCandidate {
  id: number;
  organizationId: number;
  name: string;
  alias?: string | null;
  email?: string | null;
  pec?: string | null;
}

export interface EmailClientAssociationResult {
  clientId: number | null;
  suggestedClientId: number | null;
  matchType?: "profile_contact";
  clientAssociationIssue?: "conflicting_exact_matches";
}

export function normalizeSenderEmail(value: string): string {
  const trimmed = value.trim().replace(/^.*<([^>]+)>$/, "$1").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return "";
  return trimmed;
}

export function normalizeClientEmailAddress(value: string): string {
  const trimmed = value.trim().toLowerCase();
  const wildcard = /^\*@(.+)$/.exec(trimmed);
  if (!wildcard) return normalizeSenderEmail(trimmed);

  const domain = domainToASCII(wildcard[1].replace(/\.$/, ""));
  const labels = domain.split(".");
  if (
    !domain ||
    domain.length > 253 ||
    labels.length < 2 ||
    labels.some((label) => !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))
  ) return "";
  return `*@${domain}`;
}

export function emailAddressPatternMatches(pattern: string, senderEmail: string): boolean {
  const normalizedPattern = normalizeClientEmailAddress(pattern);
  const sender = normalizeSenderEmail(senderEmail);
  if (!normalizedPattern || !sender) return false;
  if (normalizedPattern === sender) return true;
  if (!normalizedPattern.startsWith("*@")) return false;

  const senderDomain = domainToASCII(sender.slice(sender.lastIndexOf("@") + 1).replace(/\.$/, ""));
  return senderDomain === normalizedPattern.slice(2);
}

export function emailAddressPatternsOverlap(left: string, right: string): boolean {
  const normalizedLeft = normalizeClientEmailAddress(left);
  const normalizedRight = normalizeClientEmailAddress(right);
  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight) return true;
  if (normalizedLeft.startsWith("*@") && normalizedRight.startsWith("*@")) return false;
  return normalizedLeft.startsWith("*@")
    ? emailAddressPatternMatches(normalizedLeft, normalizedRight)
    : emailAddressPatternMatches(normalizedRight, normalizedLeft);
}

function clientContactMatches(client: EmailClientCandidate, sender: string): boolean {
  const emailMatches = (client.email ?? "")
    .split(/[;,\s]+/)
    .filter(Boolean)
    .some((address) => emailAddressPatternMatches(address, sender));
  const pecMatches = (client.pec ?? "")
    .split(/[;,\s]+/)
    .map(normalizeSenderEmail)
    .some((address) => address === sender);
  return emailMatches || pecMatches;
}

export function resolveEmailClientAssociation(input: {
  organizationId: number;
  senderEmail: string;
  clientsEnabled?: boolean;
  clients: EmailClientCandidate[];
}): EmailClientAssociationResult {
  if (input.clientsEnabled === false) return { clientId: null, suggestedClientId: null };
  const sender = normalizeSenderEmail(input.senderEmail);
  if (!sender) return { clientId: null, suggestedClientId: null };
  const clients = input.clients.filter((client) => client.organizationId === input.organizationId);
  const exactContactIds = new Set(
    clients.filter((client) => clientContactMatches(client, sender)).map((client) => client.id),
  );

  if (exactContactIds.size > 1) {
    return {
      clientId: null,
      suggestedClientId: null,
      clientAssociationIssue: "conflicting_exact_matches",
    };
  }
  if (exactContactIds.size === 1) {
    const clientId = [...exactContactIds][0];
    return {
      clientId,
      suggestedClientId: null,
      matchType: "profile_contact",
    };
  }

  return { clientId: null, suggestedClientId: null };
}

/**
 * Keep the outer sender authoritative for forwarded messages. The original
 * sender may supply an association only when it resolves to an actual client;
 * an unconfirmed suggestion is never enough to associate the ticket.
 */
export function chooseForwardedEmailAssociation(
  outerSender: EmailClientAssociationResult,
  originalSender?: EmailClientAssociationResult,
): EmailClientAssociationResult {
  if (outerSender.clientId != null || outerSender.clientAssociationIssue) return outerSender;
  if (originalSender?.clientId != null) return originalSender;
  return outerSender;
}
