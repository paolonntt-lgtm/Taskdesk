import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, inviteTokensTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { createSession } from "../lib/session";
import { createHash, randomBytes } from "crypto";
import { getSeatUsage, buildSeatLimitError } from "../seatService";

const router: IRouter = Router();

function hashPassword(password: string): string {
  return createHash("sha256").update(password + "ticketing_salt").digest("hex");
}

router.post("/invites", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const admin = (req as any).currentUser;

  const usage = await getSeatUsage(admin.id);
  if (usage.limitReached) {
    res.status(402).json(buildSeatLimitError(usage));
    return;
  }

  const token = randomBytes(9).toString("base64url").slice(0, 12);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await db.insert(inviteTokensTable).values({
    token,
    adminId: admin.id,
    expiresAt,
  });

  res.json({ token, expiresAt });
});

router.get("/invites/:token", async (req, res): Promise<void> => {
  const { token } = req.params;

  const [invite] = await db.select().from(inviteTokensTable)
    .where(eq(inviteTokensTable.token, token));

  if (!invite) {
    res.status(404).json({ valid: false, message: "Link non valido" });
    return;
  }
  if (new Date() > invite.expiresAt) {
    res.status(410).json({ valid: false, message: "Link scaduto" });
    return;
  }

  const [admin] = await db.select({ name: usersTable.name, organizationId: usersTable.organizationId })
    .from(usersTable).where(eq(usersTable.id, invite.adminId));

  res.json({ valid: true, adminName: admin?.name ?? "Admin", expiresAt: invite.expiresAt });
});

router.post("/invites/:token/register", async (req, res): Promise<void> => {
  const { token } = req.params;
  const { name, email, password } = req.body ?? {};

  if (!name || !email || !password) {
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

  const [invite] = await db.select().from(inviteTokensTable)
    .where(eq(inviteTokensTable.token, token));

  if (!invite || new Date() > invite.expiresAt) {
    res.status(410).json({ message: "Link non valido o scaduto" });
    return;
  }

  const [existing] = await db.select().from(usersTable)
    .where(eq(usersTable.email, String(email).toLowerCase().trim()));
  if (existing) {
    res.status(409).json({ message: "Email già in uso" });
    return;
  }

  // Re-check seat limit at registration time (admin's plan)
  const usage = await getSeatUsage(invite.adminId);
  if (usage.limitReached) {
    res.status(402).json({
      ...buildSeatLimitError(usage),
      message: "L'organizzazione ha raggiunto il limite di utenti del proprio piano. Contatta l'amministratore.",
    });
    return;
  }

  // Look up admin's organization
  const [admin] = await db.select({ organizationId: usersTable.organizationId })
    .from(usersTable).where(eq(usersTable.id, invite.adminId));

  const passwordHash = hashPassword(password);
  const [user] = await db.insert(usersTable).values({
    name: String(name).trim(),
    email: String(email).toLowerCase().trim(),
    passwordHash,
    role: "user",
    organizationId: admin?.organizationId ?? null,
    isActive: true,
  }).returning();

  // Track most recent usage but DO NOT consume the link — it's reusable
  // until it expires or the org's seat limit is reached.
  await db.update(inviteTokensTable)
    .set({ usedAt: new Date(), usedById: user.id })
    .where(eq(inviteTokensTable.token, token));

  const sessionId = createSession(user.id);
  res.setHeader(
    "Set-Cookie",
    `session_id=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`
  );

  const { passwordHash: _, ...safeUser } = user;
  res.status(201).json({ user: safeUser, message: "Registrazione completata" });
});

export default router;
