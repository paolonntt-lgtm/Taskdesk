import { Request, Response, NextFunction } from "express";
import { logger } from "./logger";

function allowedOrigins(): Set<string> {
  const origins = new Set<string>();

  const domains = process.env.REPLIT_DOMAINS?.split(",")
    .map((d) => d.trim())
    .filter(Boolean) ?? [];
  for (const d of domains) {
    origins.add(`https://${d}`);
  }

  if (process.env.REPLIT_DEV_DOMAIN) {
    origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
  }

  if (process.env.REPLIT_EXPO_DEV_DOMAIN) {
    origins.add(`https://${process.env.REPLIT_EXPO_DEV_DOMAIN}`);
  }

  origins.add("http://localhost:80");
  origins.add("http://localhost:3000");
  origins.add("http://localhost:5173");

  return origins;
}

/**
 * Middleware that rejects cross-origin requests to session-establishing routes.
 *
 * Browsers always include the `Origin` header on cross-origin POST requests,
 * so checking it is sufficient to block login-CSRF / session-forcing attacks
 * from web pages. Requests with no `Origin` header (native mobile clients,
 * server-to-server calls) are allowed through unchanged.
 */
export function requireSameOrigin(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;

  if (!origin) {
    next();
    return;
  }

  const allowed = allowedOrigins();
  if (allowed.has(origin)) {
    next();
    return;
  }

  logger.warn({ origin, method: req.method, url: req.url }, "Rejected cross-origin session-establishing request");
  res.status(403).json({ error: "Forbidden", message: "Cross-origin request rejected" });
}
