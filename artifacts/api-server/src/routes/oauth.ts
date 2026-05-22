import { Router } from "express";
import { eq, sql } from "drizzle-orm";
import { randomBytes } from "crypto";
import { db, usersTable, organizationsTable } from "@workspace/db";
import { createSession, SESSION_COOKIE_MAX_AGE } from "../lib/session";
import { appBaseUrl } from "../lib/appUrl";
import { logger } from "../lib/logger";
import { sendEmail, buildRegistrationNotificationEmail } from "../lib/email";

const router = Router();

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const pendingOAuthStates = new Map<string, number>();

function pruneExpiredStates(): void {
  const now = Date.now();
  for (const [state, createdAt] of pendingOAuthStates) {
    if (now - createdAt > OAUTH_STATE_TTL_MS) {
      pendingOAuthStates.delete(state);
    }
  }
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
  pendingOAuthStates.set(state, Date.now());

  const params = new URLSearchParams({
    client_id: googleClientId(),
    redirect_uri: getCallbackUrl(),
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "select_account",
    state,
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

router.get("/auth/google/callback", async (req, res): Promise<void> => {
  const { code, error, state } = req.query as { code?: string; error?: string; state?: string };

  if (error || !code) {
    res.redirect("/app/?oauth_error=cancelled");
    return;
  }

  if (!state || !pendingOAuthStates.has(state)) {
    logger.warn({ state, hasState: !!state }, "OAuth callback state validation failed");
    res.redirect("/app/?oauth_error=invalid_state");
    return;
  }

  const stateCreatedAt = pendingOAuthStates.get(state)!;
  pendingOAuthStates.delete(state);

  if (Date.now() - stateCreatedAt > OAUTH_STATE_TTL_MS) {
    logger.warn({ state }, "OAuth state expired");
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
      res.redirect("/app/?oauth_error=userinfo");
      return;
    }

    const email = googleUser.email.toLowerCase();
    const name = googleUser.name || email.split("@")[0];

    let [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));

    if (!user) {
      const [org] = await db.insert(organizationsTable).values({ name, onboardingDone: false }).returning();

      [user] = await db.insert(usersTable).values({
        name,
        email,
        passwordHash: "google_oauth",
        role: "admin",
        organizationId: org.id,
        isActive: true,
        avatarUrl: googleUser.picture ?? null,
        lastLoginAt: sql`now()`,
      }).returning();

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
        res.redirect("/app/?oauth_error=disabled");
        return;
      }
      await db
        .update(usersTable)
        .set({ lastLoginAt: sql`now()` })
        .where(eq(usersTable.id, user.id));
    }

    const sessionId = await createSession(user.id);
    res.setHeader(
      "Set-Cookie",
      `session_id=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_COOKIE_MAX_AGE}`
    );
    res.redirect("/app/");
  } catch (err) {
    logger.error({ err }, "Google OAuth callback error");
    res.redirect("/app/?oauth_error=server_error");
  }
});

export default router;
