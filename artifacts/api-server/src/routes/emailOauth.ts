import { Router } from "express";
import { randomBytes } from "crypto";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { appBaseUrl } from "../lib/appUrl";
import { logger } from "../lib/logger";
import {
  saveGmailTokens, deleteGmailTokens, getGmailTokens, getGmailStatus, baselineGmailOrg,
  type GmailTokens,
} from "../lib/gmailPoller";
import {
  saveMicrosoftTokens, deleteMicrosoftTokens, getMicrosoftTokens, getMicrosoftStatus, baselineMicrosoftOrg,
  type MicrosoftTokens,
} from "../lib/microsoftPoller";

const router = Router();

const STATE_TTL_MS = 10 * 60 * 1000;
interface PendingState { orgId: number; provider: "gmail" | "microsoft"; createdAt: number }
const pendingStates = new Map<string, PendingState>();

function pruneStates(): void {
  const now = Date.now();
  for (const [k, v] of pendingStates) if (now - v.createdAt > STATE_TTL_MS) pendingStates.delete(k);
}

// ─── Gmail ────────────────────────────────────────────────────────────────────

function gmailCallbackUrl(): string { return `${appBaseUrl()}/api/settings/inbound-email/gmail/callback`; }
function gmailConfigured(): boolean { return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET); }

router.get("/settings/inbound-email/gmail/connect", requireAuth, requireAdmin, (req, res): void => {
  if (!gmailConfigured()) {
    res.status(503).send("Google OAuth non configurato (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET mancanti).");
    return;
  }
  const currentUser = (req as any).currentUser;
  pruneStates();
  const state = randomBytes(24).toString("hex");
  pendingStates.set(state, { orgId: currentUser.organizationId, provider: "gmail", createdAt: Date.now() });

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: gmailCallbackUrl(),
    response_type: "code",
    scope: "https://www.googleapis.com/auth/gmail.modify email profile",
    access_type: "offline",
    prompt: "consent",
    state,
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

router.get("/settings/inbound-email/gmail/callback", async (req, res): Promise<void> => {
  const { code, error, state } = req.query as Record<string, string | undefined>;
  const redirectBase = `${appBaseUrl()}/app/settings`;

  if (error || !code) { res.redirect(`${redirectBase}?gmail_error=cancelled`); return; }
  const pending = state ? pendingStates.get(state) : undefined;
  if (!pending || pending.provider !== "gmail" || Date.now() - pending.createdAt > STATE_TTL_MS) {
    res.redirect(`${redirectBase}?gmail_error=invalid_state`); return;
  }
  pendingStates.delete(state!);
  const { orgId } = pending;

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code, client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: gmailCallbackUrl(), grant_type: "authorization_code",
      }),
    });
    const tokens = await tokenRes.json() as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string };
    if (!tokenRes.ok || !tokens.access_token || !tokens.refresh_token) {
      logger.error({ tokens, orgId }, "Gmail email token exchange failed");
      res.redirect(`${redirectBase}?gmail_error=token_exchange`); return;
    }

    const infoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const info = await infoRes.json() as { email?: string };
    if (!info.email) { res.redirect(`${redirectBase}?gmail_error=userinfo`); return; }

    const stored: GmailTokens = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      email: info.email,
      expires_at_ms: Date.now() + (tokens.expires_in ?? 3600) * 1000,
    };
    await saveGmailTokens(orgId, stored);
    // Fire-and-forget baseline
    baselineGmailOrg(orgId).catch((err) => logger.warn({ err, orgId }, "Gmail baseline failed"));
    logger.info({ orgId, email: info.email }, "Gmail email OAuth connected");
    res.redirect(`${redirectBase}?gmail_connected=1`);
  } catch (err) {
    logger.error({ err, orgId }, "Gmail email OAuth callback error");
    res.redirect(`${redirectBase}?gmail_error=server_error`);
  }
});

router.delete("/settings/inbound-email/gmail", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  await deleteGmailTokens(currentUser.organizationId);
  res.json({ ok: true });
});

// ─── Microsoft ────────────────────────────────────────────────────────────────

function msCallbackUrl(): string { return `${appBaseUrl()}/api/settings/inbound-email/microsoft/callback`; }
function msConfigured(): boolean { return !!(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET); }

router.get("/settings/inbound-email/microsoft/connect", requireAuth, requireAdmin, (req, res): void => {
  if (!msConfigured()) {
    res.status(503).send("Microsoft OAuth non configurato (MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET mancanti).");
    return;
  }
  const currentUser = (req as any).currentUser;
  pruneStates();
  const state = randomBytes(24).toString("hex");
  pendingStates.set(state, { orgId: currentUser.organizationId, provider: "microsoft", createdAt: Date.now() });

  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID!,
    redirect_uri: msCallbackUrl(),
    response_type: "code",
    scope: "offline_access Mail.Read Mail.ReadWrite User.Read",
    response_mode: "query",
    state,
  });
  res.redirect(`https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`);
});

router.get("/settings/inbound-email/microsoft/callback", async (req, res): Promise<void> => {
  const { code, error, state } = req.query as Record<string, string | undefined>;
  const redirectBase = `${appBaseUrl()}/app/settings`;

  if (error || !code) { res.redirect(`${redirectBase}?microsoft_error=cancelled`); return; }
  const pending = state ? pendingStates.get(state) : undefined;
  if (!pending || pending.provider !== "microsoft" || Date.now() - pending.createdAt > STATE_TTL_MS) {
    res.redirect(`${redirectBase}?microsoft_error=invalid_state`); return;
  }
  pendingStates.delete(state!);
  const { orgId } = pending;

  try {
    const tokenRes = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code, client_id: process.env.MICROSOFT_CLIENT_ID!,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
        redirect_uri: msCallbackUrl(), grant_type: "authorization_code",
        scope: "offline_access Mail.Read Mail.ReadWrite User.Read",
      }),
    });
    const tokens = await tokenRes.json() as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string };
    if (!tokenRes.ok || !tokens.access_token || !tokens.refresh_token) {
      logger.error({ tokens, orgId }, "Microsoft email token exchange failed");
      res.redirect(`${redirectBase}?microsoft_error=token_exchange`); return;
    }

    const infoRes = await fetch("https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const info = await infoRes.json() as { mail?: string; userPrincipalName?: string };
    const email = info.mail || info.userPrincipalName || "";
    if (!email) { res.redirect(`${redirectBase}?microsoft_error=userinfo`); return; }

    const stored: MicrosoftTokens = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      email,
      expires_at_ms: Date.now() + (tokens.expires_in ?? 3600) * 1000,
    };
    await saveMicrosoftTokens(orgId, stored);
    baselineMicrosoftOrg(orgId).catch((err) => logger.warn({ err, orgId }, "Microsoft baseline failed"));
    logger.info({ orgId, email }, "Microsoft email OAuth connected");
    res.redirect(`${redirectBase}?microsoft_connected=1`);
  } catch (err) {
    logger.error({ err, orgId }, "Microsoft email OAuth callback error");
    res.redirect(`${redirectBase}?microsoft_error=server_error`);
  }
});

router.delete("/settings/inbound-email/microsoft", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  await deleteMicrosoftTokens(currentUser.organizationId);
  res.json({ ok: true });
});

// ─── OAuth status (both providers) ──────────────────────────────────────────

router.get("/settings/inbound-email/oauth-status", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;

  const [gmailTokens, gmailStatus, microsoftTokens, microsoftStatus] = await Promise.all([
    getGmailTokens(orgId),
    getGmailStatus(orgId),
    getMicrosoftTokens(orgId),
    getMicrosoftStatus(orgId),
  ]);

  res.json({
    gmail: gmailTokens ? { email: gmailTokens.email, status: gmailStatus } : null,
    microsoft: microsoftTokens ? { email: microsoftTokens.email, status: microsoftStatus } : null,
    gmailAvailable: gmailConfigured(),
    microsoftAvailable: msConfigured(),
  });
});

export default router;
