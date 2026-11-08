import { Router } from "express";
import { eq, sql } from "drizzle-orm";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { db, usersTable, organizationsTable } from "@workspace/db";
import { createSession, SESSION_COOKIE_MAX_AGE } from "../lib/session";
import { appBaseUrl } from "../lib/appUrl";
import { logger } from "../lib/logger";
import { sendEmail, buildRegistrationNotificationEmail } from "../lib/email";
import { FREE_TRIAL_DURATION_MS } from "../lib/trialStatus";
import { attachReferralAtSignup } from "../referralService";
import {
  getOrganizationBusinessType,
  isOrganizationProfession,
  type OrganizationProfession,
} from "../lib/organizationProfession";

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
  nonce: string;
  professionalAttribution: ProfessionalTrialAttribution | null;
  registrationProfession: OrganizationProfession | null;
  referralCode: string | null;
  referralAttempted: boolean;
  utmAttribution: UTMAttribution;
};

const isProduction = process.env.NODE_ENV === "production";

function signOAuthState(payload: string): string {
  return createHmac("sha256", googleClientSecret())
    .update(`taskdesk-google-oauth-state-v1\0${payload}`)
    .digest("base64url");
}

function createOAuthState(data: Omit<PendingOAuthState, "createdAt" | "nonce">): string {
  const payload = Buffer.from(JSON.stringify({
    ...data,
    createdAt: Date.now(),
    nonce: randomBytes(24).toString("hex"),
  } satisfies PendingOAuthState)).toString("base64url");
  return `${payload}.${signOAuthState(payload)}`;
}

function readOAuthState(state: unknown): PendingOAuthState | undefined {
  if (typeof state !== "string" || state.length > 4096) return undefined;
  const [payload, signature, extra] = state.split(".");
  if (!payload || !signature || extra !== undefined) return undefined;

  const expected = Buffer.from(signOAuthState(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return undefined;

  try {
    const pending = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as PendingOAuthState;
    if (
      !Number.isFinite(pending.createdAt) ||
      typeof pending.nonce !== "string" ||
      !/^[a-f0-9]{48}$/.test(pending.nonce) ||
      !Number.isFinite(Date.now() - pending.createdAt) ||
      Date.now() - pending.createdAt < 0 ||
      Date.now() - pending.createdAt > OAUTH_STATE_TTL_MS
    ) return undefined;
    return pending;
  } catch {
    return undefined;
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

function parseRegistrationProfession(query: import("express").Request["query"]): OrganizationProfession | null {
  if (isOrganizationProfession(query.profession)) return query.profession;
  const attribution = parseProfessionalTrialAttribution(query);
  return attribution?.profession ?? null;
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

type GoogleOAuthFailure =
  | "denied"
  | "oauth_configuration"
  | "oauth_temporary"
  | "provider_error";

function classifyGoogleOAuthError(error: unknown): GoogleOAuthFailure {
  if (typeof error !== "string") return "provider_error";
  switch (error) {
    case "access_denied":
    case "admin_policy_enforced":
    case "org_internal":
      return "denied";
    case "invalid_client":
    case "invalid_request":
    case "redirect_uri_mismatch":
    case "unauthorized_client":
    case "unsupported_response_type":
      return "oauth_configuration";
    case "server_error":
    case "temporarily_unavailable":
      return "oauth_temporary";
    default:
      return "provider_error";
  }
}

function classifyTokenExchangeError(
  error: unknown,
  status: number,
): "oauth_configuration" | "oauth_temporary" | "token_exchange" {
  const providerFailure = classifyGoogleOAuthError(error);
  if (providerFailure === "oauth_configuration") return providerFailure;
  if (providerFailure === "oauth_temporary" || status === 408 || status === 429 || status >= 500) {
    return "oauth_temporary";
  }
  return "token_exchange";
}

function oauthErrorUrl(
  error: string,
  registrationProfession: OrganizationProfession | null | undefined,
): string {
  const params = new URLSearchParams();
  if (registrationProfession) params.set("mode", "register");
  params.set("oauth_error", error);
  return `/app/?${params.toString()}`;
}

router.get("/auth/google", (req, res) => {
  if (!googleClientId() || !googleClientSecret()) {
    res.redirect(oauthErrorUrl("oauth_configuration", parseRegistrationProfession(req.query)));
    return;
  }

  // The callback URL is registered on the canonical app host. If registration
  // starts on a Replit preview/alias host, first move the browser to that same
  // canonical host so the nonce cookie is available when Google returns.
  const forwardedHost = req.get("x-forwarded-host")?.split(",")[0]?.trim();
  const canonicalBaseUrl = appBaseUrl();
  const requestHost = (forwardedHost || req.get("host")?.split(",")[0]?.trim())?.toLowerCase();
  const canonicalHost = new URL(canonicalBaseUrl).host.toLowerCase();
  const isLoopbackHost =
    requestHost === "localhost" ||
    requestHost?.startsWith("localhost:") ||
    requestHost === "127.0.0.1" ||
    requestHost?.startsWith("127.0.0.1:");
  if (requestHost && !isLoopbackHost && requestHost !== canonicalHost) {
    const canonicalStartUrl = new URL("/api/auth/google", canonicalBaseUrl);
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === "string") canonicalStartUrl.searchParams.set(key, value);
      else if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === "string") canonicalStartUrl.searchParams.append(key, item);
        }
      }
    }
    res.redirect(302, canonicalStartUrl.toString());
    return;
  }

  const registrationProfession = parseRegistrationProfession(req.query);
  if (req.query.mode === "register" && !registrationProfession) {
    res.status(400).send("Seleziona una professione prima di registrarti.");
    return;
  }
  const state = createOAuthState({
    professionalAttribution: parseProfessionalTrialAttribution(req.query),
    registrationProfession,
    referralCode: typeof req.query.ref === "string" && /^[A-Za-z0-9_-]{8,40}$/.test(req.query.ref)
      ? req.query.ref
      : null,
    referralAttempted: typeof req.query.ref === "string" && req.query.ref.trim().length > 0,
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
  const code = typeof req.query.code === "string" ? req.query.code : undefined;
  const error = typeof req.query.error === "string" ? req.query.error : undefined;
  const state = typeof req.query.state === "string" ? req.query.state : undefined;

  if (error || !code) {
    const failure = error ? classifyGoogleOAuthError(error) : "cancelled";
    const pendingState = readOAuthState(state);
    const isBoundRegistration = !!pendingState && req.cookies?.[OAUTH_NONCE_COOKIE] === state &&
      !!pendingState.registrationProfession;
    logger.warn({ failure }, "Google authorization was not completed");
    res.setHeader("Set-Cookie", clearNonceCookie());
    res.redirect(oauthErrorUrl(failure, isBoundRegistration ? pendingState?.registrationProfession : null));
    return;
  }

  // Verify the signed state and bind it to the browser cookie that was
  // set in the initiating browser when /auth/google was visited. This binds
  // the callback to the browser that started the flow and prevents an attacker
  // from completing an OAuth exchange in a victim's browser (login CSRF /
  // session forcing). The signed state is self-contained so autoscale callbacks
  // can be handled by a different server instance. Google authorization codes
  // are single-use, which prevents successful callback replay.
  const nonceCookie = req.cookies?.[OAUTH_NONCE_COOKIE];
  const pendingState = readOAuthState(state);
  if (!state || !pendingState || nonceCookie !== state) {
    logger.warn(
      { hasState: !!state, hasNonce: !!nonceCookie, nonceMatch: nonceCookie === state },
      "OAuth callback state/nonce validation failed"
    );
    res.setHeader("Set-Cookie", clearNonceCookie());
    res.redirect("/app/?oauth_error=invalid_state");
    return;
  }

  try {
    let tokenRes: Response;
    try {
      tokenRes = await fetch("https://oauth2.googleapis.com/token", {
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
    } catch (err) {
      logger.warn({ errorName: err instanceof Error ? err.name : "unknown" }, "Google token endpoint unavailable");
      res.setHeader("Set-Cookie", clearNonceCookie());
      res.redirect(oauthErrorUrl("oauth_temporary", pendingState.registrationProfession));
      return;
    }
    const tokens = await tokenRes.json() as { access_token?: string; error?: unknown };

    if (!tokenRes.ok || !tokens.access_token) {
      const failure = classifyTokenExchangeError(tokens.error, tokenRes.status);
      logger.warn({ status: tokenRes.status, failure }, "Google token exchange failed");
      res.setHeader("Set-Cookie", clearNonceCookie());
      res.redirect(oauthErrorUrl(failure, pendingState.registrationProfession));
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
      logger.warn({ status: userInfoRes.status, hasEmail: !!googleUser.email }, "Failed to get Google user info");
      res.setHeader("Set-Cookie", clearNonceCookie());
      res.redirect(oauthErrorUrl("userinfo", pendingState.registrationProfession));
      return;
    }

    const email = googleUser.email.toLowerCase();
    const name = googleUser.name || email.split("@")[0];

    let [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
    let newlyCreated = false;

    if (!user) {
      if (!pendingState.registrationProfession) {
        res.setHeader("Set-Cookie", clearNonceCookie());
        res.redirect("/app/?mode=register&oauth_error=profession_required");
        return;
      }
      const [org] = await db.insert(organizationsTable).values({
        name,
        onboardingDone: false,
        profession: pendingState.registrationProfession,
        businessType: getOrganizationBusinessType(pendingState.registrationProfession),
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
        await attachReferralAtSignup(
          pendingState.referralCode,
          org.id,
          email,
          pendingState.referralAttempted,
        );
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
    res.redirect(oauthErrorUrl("server_error", pendingState.registrationProfession));
  }
});

export default router;
