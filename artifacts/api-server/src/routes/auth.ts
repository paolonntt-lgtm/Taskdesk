import { Router, type IRouter } from "express";
import { eq, sql, and } from "drizzle-orm";
import { db, usersTable, organizationsTable, settingsTable, groupMembersTable, groupsTable } from "@workspace/db";
import { createSession, destroySession, getSessionId, getCurrentUserId, SESSION_COOKIE_MAX_AGE } from "../lib/session";
import { LoginBody } from "@workspace/api-zod";
import bcrypt from "bcryptjs";
import { sendEmail, buildRegistrationNotificationEmail } from "../lib/email";
import { loginRateLimiter, registerRateLimiter } from "../lib/rateLimiter";
import { logger } from "../lib/logger";
import { STANDARD_CATEGORIES, DEFAULT_LOCATIONS } from "./settings";
import { requireSameOrigin } from "../lib/originCheck";
import { FREE_TRIAL_DURATION_MS, getTrialStatus } from "../lib/trialStatus";
import { getUserPermissionSummary } from "../lib/groupPermissions";

const router: IRouter = Router();

const BCRYPT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

function isBcryptHash(hash: string): boolean {
  return hash.startsWith("$2b$") || hash.startsWith("$2a$");
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!isBcryptHash(hash)) {
    // Legacy SHA-256 hashes are no longer accepted for authentication.
    // Affected accounts must reset their password via the "forgot password" flow.
    return false;
  }
  return bcrypt.compare(password, hash);
}

router.post("/auth/login", loginRateLimiter, requireSameOrigin, async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", message: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;

  const [row] = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      role: usersTable.role,
      organizationId: usersTable.organizationId,
      organizationName: organizationsTable.name,
      isActive: usersTable.isActive,
      isAvailable: usersTable.isAvailable,
      phone: usersTable.phone,
      avatarUrl: usersTable.avatarUrl,
      passwordHash: usersTable.passwordHash,
      createdAt: usersTable.createdAt,
      isSuperAdmin: usersTable.isSuperAdmin,
      onboardingDone: organizationsTable.onboardingDone,
      businessType: organizationsTable.businessType,
      clientsEnabled: organizationsTable.clientsEnabled,
      trialEndsAt: usersTable.trialEndsAt,
      stripeSubscriptionId: usersTable.stripeSubscriptionId,
      entitySingular: organizationsTable.entitySingular,
      entityPlural: organizationsTable.entityPlural,
    })
    .from(usersTable)
    .leftJoin(organizationsTable, eq(usersTable.organizationId, organizationsTable.id))
    .where(eq(usersTable.email, email));

  // Accounts with legacy SHA-256 hashes can no longer authenticate.
  // They must reset their password before logging in again.
  const storedHash = row?.passwordHash ?? "";
  if (row && storedHash && !storedHash.startsWith("$2b$") && !storedHash.startsWith("$2a$")) {
    res.status(401).json({
      error: "PasswordResetRequired",
      message: "Per motivi di sicurezza, è necessario reimpostare la password. Usa 'Password dimenticata'.",
    });
    return;
  }

  if (!row || !(await verifyPassword(password, storedHash))) {
    res.status(401).json({ error: "Invalid credentials", message: "Email o password non corretti" });
    return;
  }

  if (!row.isActive) {
    res.status(401).json({ error: "Account disabled", message: "Il tuo account è stato disattivato. Contatta l'amministratore." });
    return;
  }

  await db.update(usersTable).set({ lastLoginAt: sql`now()` }).where(eq(usersTable.id, row.id));

  const sessionId = await createSession(row.id);

  const isProduction = process.env.NODE_ENV === "production";
  const secureFlag = isProduction ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `session_id=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_COOKIE_MAX_AGE}${secureFlag}`
  );

  const permissionSummary = await getUserPermissionSummary(row.id, row.organizationId, row.role);

  const { passwordHash: _, ...safeUser } = row;
  const trialStatus = getTrialStatus(safeUser.trialEndsAt, safeUser.stripeSubscriptionId);
  res.json({ user: { ...safeUser, ...permissionSummary, trialStatus }, message: "Login effettuato" });
});

router.post("/auth/register", registerRateLimiter, requireSameOrigin, async (req, res): Promise<void> => {
  const { name, email, password, organizationName } = req.body ?? {};

  if (!name || !email || !password || !organizationName) {
    res.status(400).json({ message: "Tutti i campi sono obbligatori" });
    return;
  }
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ message: "Indirizzo email non valido" });
    return;
  }
  if (typeof password !== "string" || password.length < 6) {
    res.status(400).json({ message: "La password deve essere di almeno 6 caratteri" });
    return;
  }
  if (typeof organizationName !== "string" || organizationName.trim().length < 2) {
    res.status(400).json({ message: "Il nome azienda deve avere almeno 2 caratteri" });
    return;
  }

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing) {
    res.status(409).json({ message: "Email già in uso" });
    return;
  }

  const utmSource = typeof req.body.utmSource === "string" && req.body.utmSource ? req.body.utmSource : null;
  const utmMedium = typeof req.body.utmMedium === "string" && req.body.utmMedium ? req.body.utmMedium : null;
  const utmCampaign = typeof req.body.utmCampaign === "string" && req.body.utmCampaign ? req.body.utmCampaign : null;

  const [org] = await db.insert(organizationsTable).values({
    name: organizationName.trim(),
    onboardingDone: false,
    utmSource,
    utmMedium,
    utmCampaign,
  }).returning();

  // Seed default settings for the new organization
  await db.insert(settingsTable).values([
    { key: `org_${org.id}_categories`, value: JSON.stringify(STANDARD_CATEGORIES) },
    { key: `org_${org.id}_locations`, value: JSON.stringify(DEFAULT_LOCATIONS) },
  ]).onConflictDoNothing();

  const passwordHash = await hashPassword(password);
  const trialEndsAt = new Date(Date.now() + FREE_TRIAL_DURATION_MS);
  const [user] = await db.insert(usersTable).values({
    name: String(name).trim(),
    email: String(email).toLowerCase().trim(),
    passwordHash,
    role: "admin",
    organizationId: org.id,
    isActive: true,
    trialEndsAt,
  }).returning();

  const superadmins = await db.select({ email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.isSuperAdmin, true));
  const appBaseUrl = `https://${(process.env.REPLIT_DOMAINS ?? "").split(",")[0]}`;
  const registeredAt = new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome" });
  const { subject, html, text } = buildRegistrationNotificationEmail({
    userName: String(name).trim(),
    userEmail: String(email).toLowerCase().trim(),
    organizationName: org.name,
    registeredAt,
    appBaseUrl,
  });
  for (const sa of superadmins) {
    if (sa.email) sendEmail({ to: sa.email, subject, html, text });
  }

  const sessionId = await createSession(user.id);
  const isProductionReg = process.env.NODE_ENV === "production";
  const secureFlagReg = isProductionReg ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `session_id=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_COOKIE_MAX_AGE}${secureFlagReg}`
  );

  const { passwordHash: _, ...safeUser } = user;
  const permissionSummary = await getUserPermissionSummary(user.id, user.organizationId, user.role);
  res.status(201).json({ user: { ...safeUser, ...permissionSummary }, message: "Registrazione completata" });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  const sessionId = getSessionId(req);
  if (sessionId) {
    await destroySession(sessionId);
  }
  res.setHeader("Set-Cookie", "session_id=; Path=/; HttpOnly; Max-Age=0");
  res.json({ success: true, message: "Logout effettuato" });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const userId = await getCurrentUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [row] = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      role: usersTable.role,
      organizationId: usersTable.organizationId,
      organizationName: organizationsTable.name,
      isActive: usersTable.isActive,
      isAvailable: usersTable.isAvailable,
      phone: usersTable.phone,
      avatarUrl: usersTable.avatarUrl,
      createdAt: usersTable.createdAt,
      isSuperAdmin: usersTable.isSuperAdmin,
      onboardingDone: organizationsTable.onboardingDone,
      businessType: organizationsTable.businessType,
      clientsEnabled: organizationsTable.clientsEnabled,
      trialEndsAt: usersTable.trialEndsAt,
      stripeSubscriptionId: usersTable.stripeSubscriptionId,
      tourDone: usersTable.tourDone,
      registeredViaInvite: usersTable.registeredViaInvite,
      entitySingular: organizationsTable.entitySingular,
      entityPlural: organizationsTable.entityPlural,
      lastLoginAt: usersTable.lastLoginAt,
    })
    .from(usersTable)
    .leftJoin(organizationsTable, eq(usersTable.organizationId, organizationsTable.id))
    .where(eq(usersTable.id, userId));

  if (!row) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  if (!row.isActive) {
    const sessionId = getSessionId(req);
    if (sessionId) await destroySession(sessionId);
    res.status(401).json({ error: "Account disabled" });
    return;
  }

  // Refresh lastLoginAt at most once per day (fire-and-forget — does not block the response).
  // This covers users who stay logged in via session cookie without going through the login form.
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if (!row.lastLoginAt || row.lastLoginAt < oneDayAgo) {
    db.update(usersTable)
      .set({ lastLoginAt: sql`now()` })
      .where(eq(usersTable.id, userId))
      .catch((err: unknown) => logger.error({ err }, "Failed to refresh lastLoginAt on auth/me"));
  }

  const trialStatus = getTrialStatus(row.trialEndsAt, row.stripeSubscriptionId);
  const permissionSummary = await getUserPermissionSummary(row.id, row.organizationId, row.role);
  res.json({ ...row, ...permissionSummary, trialStatus });
});

router.post("/auth/me/tour-done", async (req, res): Promise<void> => {
  const userId = await getCurrentUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  await db.update(usersTable).set({ tourDone: true }).where(eq(usersTable.id, userId));
  res.json({ success: true });
});

export default router;
