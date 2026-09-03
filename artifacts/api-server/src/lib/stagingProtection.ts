import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

const DEFAULT_PUBLIC_PRODUCTION_HOSTS = new Set([
  "taskdesk.it",
  "www.taskdesk.it",
  "taskdesk.uk",
  "www.taskdesk.uk",
  "taskdesk.replit.app",
]);

function isTruthy(value: string | undefined): boolean {
  return value === "1" || value === "true" || value === "yes";
}

function publicProductionHosts(): Set<string> {
  const configured = (process.env.PUBLIC_PRODUCTION_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase().replace(/:\d+$/, ""))
    .filter(Boolean);
  return new Set([...DEFAULT_PUBLIC_PRODUCTION_HOSTS, ...configured]);
}

function requestHost(req: Request): string {
  const forwardedHost = req.get("x-forwarded-host");
  const host = forwardedHost || req.get("host") || "";
  return host.split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");
}

export function isStagingRequest(req: Request): boolean {
  if (isTruthy(process.env.STAGING_PROTECTION)) return true;
  if (process.env.NODE_ENV !== "production") return false;
  return !publicProductionHosts().has(requestHost(req));
}

function hasValidBasicAuth(req: Request, expectedCredentials: string): boolean {
  const authorization = req.get("authorization");
  if (!authorization?.startsWith("Basic ")) return false;

  try {
    const actual = Buffer.from(authorization.slice(6).trim(), "base64");
    const expected = Buffer.from(expectedCredentials, "utf8");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  if (process.env.NODE_ENV === "production") {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  }
  next();
}

export function stagingProtection(req: Request, res: Response, next: NextFunction): void {
  const isStaging = isStagingRequest(req);
  if (!isStaging || req.path === "/healthz" || req.path === "/api/healthz") {
    next();
    return;
  }

  const expectedCredentials = process.env.STAGING_BASIC_AUTH?.trim();
  if (!expectedCredentials) {
    res.status(503).json({ error: "Staging access is not configured" });
    return;
  }

  if (!hasValidBasicAuth(req, expectedCredentials)) {
    res.setHeader("WWW-Authenticate", 'Basic realm="TaskDesk staging", charset="UTF-8"');
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  next();
}