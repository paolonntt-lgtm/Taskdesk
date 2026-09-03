import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";

/**
 * Global API budget: protects every endpoint, including routes added later,
 * while the narrower limiters below protect especially expensive operations.
 * The built-in IP key uses IPv6-safe subnet normalization.
 */
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) =>
    req.method === "OPTIONS" ||
    req.path === "/healthz" ||
    req.path === "/stripe/webhook" ||
    req.path === "/inbound-email",
  message: { message: "Troppe richieste. Riprova tra qualche secondo." },
});

/**
 * Login: 10 attempts per 15 minutes per IP.
 * Mitigates credential-stuffing and online password guessing.
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Troppi tentativi di accesso. Riprova tra 15 minuti." },
  skipSuccessfulRequests: true,
});

/**
 * Registration: 5 new accounts per hour per IP.
 * Prevents bulk account creation.
 */
export const registerRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Troppo molte registrazioni. Riprova tra un'ora." },
});

/**
 * Forgot-password: 5 requests per hour per IP.
 * Prevents email-flooding / alert-fatigue attacks against victim accounts.
 */
export const forgotPasswordRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Troppi tentativi di reset. Riprova tra un'ora." },
});

/**
 * Reset-password token submission: 10 attempts per 15 minutes per IP.
 * Limits brute-force of short-lived reset tokens.
 */
export const resetPasswordRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Troppi tentativi. Riprova tra 15 minuti." },
});

/**
 * Bot chat: 20 requests per minute per authenticated user.
 * Keyed on user ID (from the session attached by requireAuth) so that
 * rotating IPs or shared NAT does not dilute the limit, and a single
 * compromised account cannot abuse the paid LLM endpoint without bound.
 * Falls back to IP if the session is not yet populated (should not happen
 * in practice because requireAuth runs first).
 */
export const botChatRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { ip: false },
  keyGenerator: (req: Request) => {
    const user = (req as any).currentUser;
    return user?.id != null
      ? `user:${user.id}`
      : `ip:${ipKeyGenerator(req.ip ?? "unknown")}`;
  },
  message: { message: "Troppe richieste al bot. Riprova tra qualche secondo." },
});

/**
 * AI title suggestions have a separate budget because each request consumes
 * an external paid model call.
 */
export const aiSuggestRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { ip: false },
  keyGenerator: (req: Request) => {
    const user = (req as any).currentUser;
    return user?.id != null
      ? `user:${user.id}`
      : `ip:${ipKeyGenerator(req.ip ?? "unknown")}`;
  },
  message: { message: "Troppe richieste AI. Riprova tra qualche secondo." },
});

/**
 * Inbound-email webhook: 60 requests per minute per IP.
 * The endpoint is protected by a shared secret token, but rate-limiting
 * limits the blast radius if that token is ever compromised — an attacker
 * can no longer flood thousands of tickets per minute from a single IP.
 */
export const inboundEmailRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});
