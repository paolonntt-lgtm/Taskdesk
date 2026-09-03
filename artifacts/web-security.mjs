import { timingSafeEqual } from "node:crypto";

const DEFAULT_PUBLIC_PRODUCTION_HOSTS = new Set([
  "taskdesk.it",
  "www.taskdesk.it",
  "taskdesk.uk",
  "www.taskdesk.uk",
  "taskdesk.replit.app",
]);

function isTruthy(value) {
  return value === "1" || value === "true" || value === "yes";
}

function requestHost(req) {
  const forwardedHost = req.headers["x-forwarded-host"];
  const hostHeader = forwardedHost || req.headers.host || "";
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
  return String(host).split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");
}

function publicProductionHosts() {
  const configured = (process.env.PUBLIC_PRODUCTION_HOSTS || "")
    .split(",")
    .map((host) => host.trim().toLowerCase().replace(/:\d+$/, ""))
    .filter(Boolean);
  return new Set([...DEFAULT_PUBLIC_PRODUCTION_HOSTS, ...configured]);
}

export function isStagingRequest(req) {
  if (isTruthy(process.env.STAGING_PROTECTION)) return true;
  if (process.env.NODE_ENV !== "production") return false;
  return !publicProductionHosts().has(requestHost(req));
}

export function applyWebSecurityHeaders(res, { staging = false } = {}) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  if (process.env.NODE_ENV === "production") {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  }
  if (staging) {
    res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
    res.setHeader("Cache-Control", "no-store, max-age=0");
  }
}

function requestPath(req) {
  try {
    return new URL(req.url || "/", "http://localhost").pathname;
  } catch {
    return "/";
  }
}

function hasValidBasicAuth(req, expectedCredentials) {
  const authorization = req.headers.authorization;
  if (typeof authorization !== "string" || !authorization.startsWith("Basic ")) {
    return false;
  }

  try {
    const received = Buffer.from(authorization.slice(6).trim(), "base64").toString(
      "utf8",
    );
    const expected = Buffer.from(expectedCredentials, "utf8");
    const actual = Buffer.from(received, "utf8");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function enforceStagingAccess(req, res, { healthPaths = [] } = {}) {
  const staging = isStagingRequest(req);
  applyWebSecurityHeaders(res, { staging });

  if (!staging || healthPaths.includes(requestPath(req))) {
    return false;
  }

  const expectedCredentials = process.env.STAGING_BASIC_AUTH?.trim();
  if (!expectedCredentials) {
    res.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Staging access is not configured");
    return true;
  }

  if (!hasValidBasicAuth(req, expectedCredentials)) {
    res.writeHead(401, {
      "Content-Type": "text/plain; charset=utf-8",
      "WWW-Authenticate": 'Basic realm="TaskDesk staging", charset="UTF-8"',
    });
    res.end("Authentication required");
    return true;
  }

  return false;
}