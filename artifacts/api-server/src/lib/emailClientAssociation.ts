import { domainToASCII } from "node:url";

export interface EmailClientCandidate {
  id: number;
  organizationId: number;
  name: string;
  alias?: string | null;
  email?: string | null;
  pec?: string | null;
}

export interface EmailClientRule {
  organizationId: number;
  clientId: number;
  senderEmail?: string;
  domain?: string;
}

export interface EmailClientAssociationResult {
  clientId: number | null;
  suggestedClientId: number | null;
  clientAssociationIssue?: "conflicting_exact_matches" | "conflicting_domain_rules";
}

const GENERIC_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "msn.com",
  "yahoo.com", "yahoo.it", "icloud.com", "me.com", "mac.com", "aol.com", "proton.me",
  "protonmail.com", "gmx.com", "gmx.net", "libero.it", "virgilio.it", "tin.it",
  "alice.it", "tim.it", "fastwebnet.it", "tiscali.it", "pec.it", "hotmail.co.uk",
  "yahoo.co.uk", "yahoo.co.jp", "yahoo.com.au", "outlook.it", "hotmail.it",
  "mail.com", "email.com", "fastmail.com", "yandex.com", "yandex.ru", "zoho.com", "hey.com",
  "tutanota.com", "tuta.io", "protonmail.ch", "pm.me", "gmx.de", "gmx.at", "web.de",
  "orange.fr", "free.fr", "laposte.net", "sfr.fr", "wanadoo.fr", "aruba.it", "legalmail.it",
  "pecmail.it", "namirial.it", "postacertificata.com", "registerpec.it",
]);
const GENERIC_EMAIL_DOMAIN_LABELS = new Set([
  "gmail", "googlemail", "outlook", "hotmail", "live", "msn", "yahoo", "icloud",
  "me", "mac", "aol", "proton", "protonmail", "gmx", "libero", "virgilio",
  "tin", "alice", "tim", "fastwebnet", "tiscali", "pec", "mail", "email", "fastmail",
  "yandex", "zoho", "hey", "tutanota", "tuta", "web", "orange", "free", "laposte",
  "sfr", "wanadoo", "aruba", "legalmail", "pecmail", "namirial", "postacertificata",
  "registerpec",
]);
const TWO_PART_PUBLIC_SUFFIXES = new Set([
  "co.uk", "org.uk", "ac.uk", "gov.uk", "com.au", "net.au", "org.au", "edu.au",
  "co.nz", "org.nz", "com.br", "com.mx", "com.sg", "com.hk", "co.jp", "co.in",
  "com.tr", "com.ar", "co.za",
]);

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

export function domainForSender(email: string): string | null {
  const normalized = normalizeSenderEmail(email);
  if (!normalized) return null;
  const domain = domainToASCII(normalized.slice(normalized.lastIndexOf("@") + 1).replace(/\.$/, ""));
  if (!domain) return null;
  if (GENERIC_EMAIL_DOMAINS.has(domain) || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(domain)) return null;
  const labels = domain.split(".");
  if (labels.length < 2 || labels.some((label) => !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))) return null;
  const suffix = labels.slice(-2).join(".");
  const registeredLabelIndex = TWO_PART_PUBLIC_SUFFIXES.has(suffix) ? labels.length - 3 : labels.length - 2;
  if (registeredLabelIndex < 0) return null;
  const companyLabel = labels[registeredLabelIndex].replace(/[^a-z0-9]/g, "");
  if (GENERIC_EMAIL_DOMAIN_LABELS.has(companyLabel) || companyLabel.length < 3) return null;
  return labels.slice(registeredLabelIndex).join(".");
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
  senderRules: EmailClientRule[];
  domainRules: EmailClientRule[];
}): EmailClientAssociationResult {
  if (input.clientsEnabled === false) return { clientId: null, suggestedClientId: null };
  const sender = normalizeSenderEmail(input.senderEmail);
  if (!sender) return { clientId: null, suggestedClientId: null };
  const clients = input.clients.filter((client) => client.organizationId === input.organizationId);
  const validClientIds = new Set(clients.map((client) => client.id));
  const exactContactIds = new Set(
    clients.filter((client) => clientContactMatches(client, sender)).map((client) => client.id),
  );
  const learnedExactIds = new Set(
    input.senderRules
      .filter((rule) => rule.organizationId === input.organizationId && normalizeSenderEmail(rule.senderEmail ?? "") === sender && validClientIds.has(rule.clientId))
      .map((rule) => rule.clientId),
  );
  const exactIds = new Set([...exactContactIds, ...learnedExactIds]);

  // Conflicting contact data or learned rules are ambiguous and must never auto-assign.
  if (exactIds.size > 1) {
    return {
      clientId: null,
      suggestedClientId: null,
      clientAssociationIssue: "conflicting_exact_matches",
    };
  }
  if (exactIds.size === 1) return { clientId: [...exactIds][0], suggestedClientId: null };

  const senderDomain = domainForSender(sender);
  if (!senderDomain) return { clientId: null, suggestedClientId: null };
  const confirmedDomainIds = new Set(
    input.domainRules
      .filter((rule) => rule.organizationId === input.organizationId && rule.domain === senderDomain && validClientIds.has(rule.clientId))
      .map((rule) => rule.clientId),
  );
  if (confirmedDomainIds.size === 1) {
    return { clientId: [...confirmedDomainIds][0], suggestedClientId: null };
  }
  if (confirmedDomainIds.size > 1) {
    return {
      clientId: null,
      suggestedClientId: null,
      clientAssociationIssue: "conflicting_domain_rules",
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
