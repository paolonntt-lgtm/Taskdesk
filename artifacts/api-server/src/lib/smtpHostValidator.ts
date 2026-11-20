/**
 * SSRF guard for SMTP host configuration.
 *
 * Validates that a prospective SMTP host does not point at loopback,
 * RFC-1918 private, link-local, cloud-metadata, or other reserved
 * address space — either as a literal IP or via DNS resolution.
 */

import net from "net";
import dns from "dns";
import { domainToASCII } from "node:url";

// ── Blocked IPv4 ranges ────────────────────────────────────────────────────

/**
 * Returns true when `ip` is a dotted-quad IPv4 address that falls within
 * a range that must never be reached by an outbound SMTP connection.
 */
function isBlockedIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return false;
  }
  const [a, b, c] = parts;

  if (a === 0) return true;                              // 0.0.0.0/8 — unspecified
  if (a === 10) return true;                             // 10.0.0.0/8 — RFC 1918
  if (a === 100 && b >= 64 && b <= 127) return true;    // 100.64.0.0/10 — RFC 6598 shared
  if (a === 127) return true;                            // 127.0.0.0/8 — loopback
  if (a === 169 && b === 254) return true;               // 169.254.0.0/16 — link-local / AWS/GCP metadata
  if (a === 172 && b >= 16 && b <= 31) return true;     // 172.16.0.0/12 — RFC 1918
  if (a === 192 && b === 0 && c === 2) return true;     // 192.0.2.0/24 — TEST-NET-1
  if (a === 192 && b === 168) return true;               // 192.168.0.0/16 — RFC 1918
  if (a === 198 && (b === 18 || b === 19)) return true;  // 198.18.0.0/15 — benchmarking
  if (a === 198 && b === 51 && c === 100) return true;  // 198.51.100.0/24 — TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true;   // 203.0.113.0/24 — TEST-NET-3
  if (a >= 240) return true;                             // 240.0.0.0/4 — reserved; 255.255.255.255

  return false;
}

// ── Blocked IPv6 ranges ────────────────────────────────────────────────────

/**
 * Converts an IPv4-mapped hex pair (two 16-bit hex words) into a dotted-
 * quad string so we can re-use `isBlockedIPv4`.
 * e.g. "7f00" + "0001" → "127.0.0.1"
 */
function hexWordPairToIPv4(hi: string, lo: string): string {
  const h = parseInt(hi, 16);
  const l = parseInt(lo, 16);
  return `${(h >> 8) & 0xff}.${h & 0xff}.${(l >> 8) & 0xff}.${l & 0xff}`;
}

/**
 * Returns true when `addr` is an IPv6 address that must be blocked.
 * Handles:
 *   ::1               — loopback
 *   ::ffff:x.x.x.x   — IPv4-mapped (dotted notation)
 *   ::ffff:hhhh:hhhh  — IPv4-mapped (hex word notation)
 *   ::                — unspecified
 *   fe80::/10         — link-local
 *   fc00::/7          — unique-local (ULA)
 *   ff00::/8          — multicast
 */
function isBlockedIPv6(addr: string): boolean {
  const a = addr.replace(/^\[|\]$/g, "").toLowerCase();

  if (a === "::1") return true;  // loopback
  if (a === "::") return true;   // unspecified

  // IPv4-mapped: ::ffff:a.b.c.d
  const v4DottedMatch = a.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4DottedMatch) return isBlockedIPv4(v4DottedMatch[1]);

  // IPv4-mapped: ::ffff:hhhh:hhhh
  const v4HexMatch = a.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (v4HexMatch) return isBlockedIPv4(hexWordPairToIPv4(v4HexMatch[1], v4HexMatch[2]));

  // Link-local fe80::/10  (fe80 – febf)
  if (/^fe[89ab][0-9a-f]/i.test(a)) return true;

  // Unique-local fc00::/7  (fc00 – fdff)
  if (/^f[cd]/i.test(a)) return true;

  // Multicast ff00::/8
  if (a.startsWith("ff")) return true;

  return false;
}

// ── Blocked hostname literals ─────────────────────────────────────────────

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "ip6-localhost",
  "ip6-loopback",
  "broadcasthost",
]);

// ── Public API ─────────────────────────────────────────────────────────────

export interface SmtpResolvedAddress {
  address: string;
  family: 4 | 6;
}

export type SmtpHostValidation =
  | { ok: true; host: string; servername?: string }
  | { ok: false; error: string };

type HostLookup = (hostname: string) => Promise<SmtpResolvedAddress[]>;

const INVALID_HOST_ERROR = "L'host SMTP non è valido o non è stato risolto";
const BLOCKED_HOST_ERROR = "L'host SMTP non può essere un indirizzo IP privato, di loopback o riservato";

function isValidHostname(hostname: string): boolean {
  const withoutTrailingDot = hostname.endsWith(".") ? hostname.slice(0, -1) : hostname;
  if (!withoutTrailingDot || withoutTrailingDot.length > 253) return false;
  return withoutTrailingDot.split(".").every((label) =>
    label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label)
  );
}

async function systemLookup(hostname: string): Promise<SmtpResolvedAddress[]> {
  const addresses = await dns.promises.lookup(hostname, { all: true, verbatim: true });
  return addresses.map(({ address, family }) => ({ address, family: family as 4 | 6 }));
}

/**
 * Validates an SMTP host and returns a numeric address for Nodemailer to
 * connect to directly. The original hostname is retained for TLS SNI and
 * certificate verification. Numeric host encodings are normalized by the
 * system resolver, and DNS errors fail closed.
 */
export async function validateSmtpHost(host: string, lookupHost: HostLookup = systemLookup): Promise<SmtpHostValidation> {
  const trimmed = host.trim();
  if (!trimmed) return { ok: false, error: INVALID_HOST_ERROR };

  const isBracketed = trimmed.startsWith("[") || trimmed.endsWith("]");
  if (isBracketed && !(trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    return { ok: false, error: INVALID_HOST_ERROR };
  }
  const unbracketed = isBracketed ? trimmed.slice(1, -1) : trimmed;

  if (net.isIPv4(unbracketed)) {
    if (isBlockedIPv4(unbracketed)) return { ok: false, error: BLOCKED_HOST_ERROR };
    return { ok: true, host: unbracketed };
  }

  if (net.isIPv6(unbracketed)) {
    if (isBlockedIPv6(unbracketed)) return { ok: false, error: BLOCKED_HOST_ERROR };
    return { ok: true, host: unbracketed };
  }

  const asciiHostname = domainToASCII(unbracketed).toLowerCase();
  const hostname = asciiHostname.endsWith(".") ? asciiHostname.slice(0, -1) : asciiHostname;
  if (!asciiHostname || !isValidHostname(asciiHostname)) {
    return { ok: false, error: INVALID_HOST_ERROR };
  }
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return { ok: false, error: "L'host SMTP non può essere un indirizzo riservato o di loopback" };
  }

  let addresses: SmtpResolvedAddress[];
  try {
    // getaddrinfo canonicalizes legacy numeric IP forms and checks the
    // addresses Node will actually dial, unlike resolve4/resolve6.
    addresses = await lookupHost(asciiHostname);
  } catch {
    return { ok: false, error: INVALID_HOST_ERROR };
  }
  if (addresses.length === 0) return { ok: false, error: INVALID_HOST_ERROR };

  for (const resolved of addresses) {
    if (
      (resolved.family === 4 && isBlockedIPv4(resolved.address)) ||
      (resolved.family === 6 && isBlockedIPv6(resolved.address))
    ) {
      return { ok: false, error: BLOCKED_HOST_ERROR };
    }
  }

  const firstAddress = addresses[0];
  const isNumericAddressForm = /^(?:0x[0-9a-f]+|[0-9.]+)$/i.test(hostname);
  return {
    ok: true,
    host: firstAddress.address,
    ...(!isNumericAddressForm ? { servername: hostname } : {}),
  };
}
