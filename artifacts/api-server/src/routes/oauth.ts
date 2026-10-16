import { Router } from "express";
import { eq, sql } from "drizzle-orm";
import { randomBytes } from "crypto";
import { db, usersTable, organizationsTable } from "@workspace/db";
import { createSession, SESSION_COOKIE_MAX_AGE } from "../lib/session";
import { appBaseUrl } from "../lib/appUrl";
import { logger } from "../lib/logger";
import { sendEmail, buildRegistrationNotificationEmail } from "../lib/email";
import { FREE_TRIAL_DURATION_MS } from "../lib/trialStatus";
import { attachReferralAtSignup } from "../referralService";

const router = Router();

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const OAUTH_NONCE_COOKIE = "oauth_nonce";
type ProfessionalTrialAttribution = {
  profession:
    | "commercialisti"
    | "avvocati"
    | "consulenti-del-lavoro"
    | "agenzie"
    | "notai"
    | "commercio";
  language: "it" | "en";
};
type UTMAttribution = {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
};
type PendingOAuthState = {
  createdAt: number;
  professionalAttribution: ProfessionalTrialAttribution | null;
  referralCode: string | null;
  utmAttribution: UTMAttribution;
};
const pendingOAuthStates = new Map<string, PendingOAuthState>();

const isProduction = process.env.NODE_ENV === "production";

function pruneExpiredStates(): void {
  const now = Date.now();
  for (const [state, pending] of pendingOAuthStates) {
    if (now - pending.createdAt > OAUTH_STATE_TTL_MS) {
      pendingOAuthStates.delete(state);
    }
  }
}

function parseProfessionalTrialAttribution(query: import("express").Request["query"]): ProfessionalTrialAttribution | null {
  const profession = query.trial_profession;
  const language = query.trial_language;
  const allowedProfessions = [
    "commercialisti",
    "avvocati",
    "consulenti-del-lavoro",
    "agenzie",
    "notai",
    "commercio",
  ];
  if (typeof profession !== "string" || !allowedProfessions.includes(profession)) return null;
  if (language !== "it" && language !== "en") return null;
  return { profession: profession as ProfessionalTrialAttribution["profession"], language };
}

function parseUtmAttribution(query: import("express").Request["query"]): UTMAttribution {
  const read = (value: unknown): string | null => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 && trimmed.length <= 200 ? trimmed : null;
  };
  return {
    utmSource: read(query.utm_source),
    utmMedium: read(query.utm_medium),
    utmCampaign: read(query.utm_campaign),
  };
}

function nonceCookieValue(state: string): string {
  const base = `${OAUTH_NONCE_COOKIE}=${state}; Path=/api/auth/google; HttpOnly; SameSite=Lax; Max-Age=600`;
  return isProduction ? `${base}; Secure` : base;
}

function clearNonceCookie(): string {
  const base = `${OAUTH_NONCE_COOKIE}=; Path=/api/auth/google; HttpOnly; Max-Age=0`;
  return isProduction ? `${base}; Secure` : base;
}

function sessionCookieValue(sessionId: string): string {
  const base = `session_id=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_COOKIE_MAX_AGE}`;
  return isProduction ? `${base}; Secure` : base;
}

function sendOAuthSuccessPage(
  res: import("express").Response,
  professionalAttribution: ProfessionalTrialAttribution | null = null,
  referralCode: string | null = null,
): void {
  const query = new URLSearchParams();
  if (professionalAttribution) {
    query.set("oauth_trial_signup", "1");
    query.set("trial_profession", professionalAttribution.profession);
    query.set("trial_language", professionalAttribution.language);
  }
  if (referralCode) query.set("ref", referralCode);
  const appPath = query.size > 0 ? `/app/?${query.toString()}` : "/app/";
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(
    `<!DOCTYPE html><html><head><meta charset="utf-8">` +
    `<meta http-equiv="refresh" content="0;url=${appPath}">` +
    `<script>window.location.replace(${JSON.stringify(appPath)})</script>` +
    `</head><body><a href="${appPath}">Continua su TaskDesk</a></body></html>`
  );
}

function googleClientId(): string {
  return process.env.GOOGLE_CLIENT_ID ?? "";
}
function googleClientSecret(): string {
  return process.env.GOOGLE_CLIENT_SECRET ?? "";
}
function getCallbackUrl(): string {
  return `${appBaseUrl()}/api/auth/google/callback`;
}

router.get("/auth/google", (req, res) => {
  if (!googleClientId()) {
    res.status(503).send("Google OAuth non configurato. Imposta GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET.");
    return;
  }

  pruneExpiredStates();
  const state = randomBytes(24).toString("hex");
  pendingOAuthStates.set(state, {
    createdAt: Date.now(),
    professionalAttribution: parseProfessionalTrialAttribution(req.query),
    referralCode: typeof req.query.ref === "string" && /^[A-Za-z0-9_-]{8,40}$/.test(req.query.ref)
      ? req.query.ref
      : null,
    utmAttribution: parseUtmAttribution(req.query),
  });

  const params = new URLSearchParams({
    client_id: googleClientId(),
    redirect_uri: getCallbackUrl(),
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "select_account",
    state,
  });
  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  // Set the nonce cookie on a 200 response (not a 302) because the Replit
  // deployment proxy strips Set-Cookie headers from redirect responses.
  // The browser will receive the cookie here and include it on the callback
  // (SameSite=Lax allows cookies on top-level GET navigations from Google).
  res.setHeader("Set-Cookie", nonceCookieValue(state));
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(
    `<!DOCTYPE html><html><head><meta charset="utf-8">` +
    `<meta http-equiv="refresh" content="0;url=${googleAuthUrl}">` +
    `<script>window.location.replace(${JSON.stringify(googleAuthUrl)})</script>` +
    `</head><body></body></html>`
  );
});

router.get("/auth/google/callback", async (req, res): Promise<void> => {
  const { code, error, state } = req.query as { code?: string; error?: string; state?: string };

  if (error || !code) {
    res.setHeader("Set-Cookie", clearNonceCookie());
    res.redirect("/app/?oauth_error=cancelled");
    return;
  }

  // Verify state exists in the server-side map (not expired, not reused).
  // Additionally, verify the state matches the oauth_nonce cookie that was
  // set in the initiating browser when /auth/google was visited. This binds
  // the callback to the browser that started the flow and prevents an attacker
  // from completing an OAuth exchange in a victim's browser (login CSRF /
  // session forcing). The nonce cookie is set on a 200 response (not a 302)
  // to work around the Replit proxy stripping Set-Cookie on redirects.
  const nonceCookie = req.cookies?.[OAUTH_NONCE_COOKIE];
  const pendingState = state ? pendingOAuthStates.get(state) : undefined;
  if (!state || !pendingState || nonceCookie !== state) {
    logger.warn(
      { state, hasState: !!state, hasNonce: !!nonceCookie, nonceMatch: nonceCookie === state },
      "OAuth callback state/nonce validation failed"
    );
    res.setHeader("Set-Cookie", clearNonceCookie());
    res.redirect("/app/?oauth_error=invalid_state");
    return;
  }

  pendingOAuthStates.delete(state);

  if (Date.now() - pendingState.createdAt > OAUTH_STATE_TTL_MS) {
    logger.warn({ state }, "OAuth state expired");
    res.setHeader("Set-Cookie", clearNonceCookie());
    res.redirect("/app/?oauth_error=invalid_state");
    return;
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: googleClientId(),
        client_secret: googleClientSecret(),
        redirect_uri: getCallbackUrl(),
        grant_type: "authorization_code",
      }),
    });
    const tokens = await tokenRes.json() as { access_token?: string; error?: string };

    if (!tokenRes.ok || !tokens.access_token) {
      logger.error({ tokens }, "Google token exchange failed");
      res.setHeader("Set-Cookie", clearNonceCookie());
      res.redirect("/app/?oauth_error=token_exchange");
      return;
    }

    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const googleUser = await userInfoRes.json() as {
      email?: string;
      name?: string;
      picture?: string;
    };

    if (!userInfoRes.ok || !googleUser.email) {
      logger.error({ googleUser }, "Failed to get Google user info");
      res.setHeader("Set-Cookie", clearNonceCookie());
      res.redirect("/app/?oauth_error=userinfo");
      return;
    }

    const email = googleUser.email.toLowerCase();
    const name = googleUser.name || email.split("@")[0];

    let [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
    let newlyCreated = false;

    if (!user) {
      const [org] = await db.insert(organizationsTable).values({
        name,
        onboardingDone: false,
        utmSource: pendingState.utmAttribution.utmSource,
        utmMedium: pendingState.utmAttribution.utmMedium,
        utmCampaign: pendingState.utmAttribution.utmCampaign,
      }).returning();

      const trialEndsAt = new Date(Date.now() + FREE_TRIAL_DURATION_MS);
      [user] = await db.insert(usersTable).values({
        name,
        email,
        passwordHash: "google_oauth",
        role: "admin",
        organizationId: org.id,
        isActive: true,
        avatarUrl: googleUser.picture ?? null,
        lastLoginAt: sql`now()`,
        trialEndsAt,
      }).returning();
      newlyCreated = true;
      try {
        await attachReferralAtSignup(pendingState.referralCode, org.id, email);
      } catch (err) {
        logger.warn({ err }, "Referral attribution skipped during Google registration");
      }

      const superadmins = await db
        .select({ email: usersTable.email })
        .from(usersTable)
        .where(eq(usersTable.isSuperAdmin, true));

      const base = appBaseUrl();
      const registeredAt = new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome" });
      const { subject, html, text } = buildRegistrationNotificationEmail({
        userName: name,
        userEmail: email,
        organizationName: org.name,
        registeredAt,
        appBaseUrl: base,
      });
      for (const sa of superadmins) {
        if (sa.email) sendEmail({ to: sa.email, subject, html, text });
      }
    } else {
      if (!user.isActive) {
        res.setHeader("Set-Cookie", clearNonceCookie());
        res.redirect("/app/?oauth_error=disabled");
        return;
      }
      await db
        .update(usersTable)
        .set({ lastLoginAt: sql`now()` })
        .where(eq(usersTable.id, user.id));
    }

    const sessionId = await createSession(user.id);
    res.setHeader("Set-Cookie", [clearNonceCookie(), sessionCookieValue(sessionId)]);
    // The Replit deployment proxy strips Set-Cookie from 302 responses.
    // Deliver the session cookie on a 200 page, then navigate to the app.
    sendOAuthSuccessPage(
      res,
      newlyCreated ? pendingState.professionalAttribution : null,
      newlyCreated ? pendingState.referralCode : null,
    );
  } catch (err) {
    logger.error({ err }, "Google OAuth callback error");
    res.setHeader("Set-Cookie", clearNonceCookie());
    res.redirect("/app/?oauth_error=server_error");
  }
});

export default router;
