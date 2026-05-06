import rateLimit from "express-rate-limit";

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
