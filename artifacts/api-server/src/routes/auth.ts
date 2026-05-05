import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, usersTable, organizationsTable } from "@workspace/db";
import { createSession, destroySession, getSessionId, getCurrentUserId } from "../lib/session";
import { LoginBody } from "@workspace/api-zod";
import { createHash } from "crypto";
import { sendEmail, buildRegistrationNotificationEmail } from "../lib/email";

const router: IRouter = Router();

function hashPassword(password: string): string {
  return createHash("sha256").update(password + "ticketing_salt").digest("hex");
}

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", message: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;
  const passwordHash = hashPassword(password);

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email));

  if (!user || user.passwordHash !== passwordHash) {
    res.status(401).json({ error: "Invalid credentials", message: "Email o password non corretti" });
    return;
  }

  // Record last login timestamp
  await db.update(usersTable)
    .set({ lastLoginAt: sql`now()` })
    .where(eq(usersTable.id, user.id));

  const sessionId = createSession(user.id);

  res.setHeader(
    "Set-Cookie",
    `session_id=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`
  );

  const { passwordHash: _, ...safeUser } = user;
  res.json({ user: safeUser, message: "Login effettuato" });
});

router.post("/auth/register", async (req, res): Promise<void> => {
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

  // Create organization first, then the admin user
  const [org] = await db.insert(organizationsTable).values({
    name: organizationName.trim(),
  }).returning();

  const passwordHash = hashPassword(password);
  const [user] = await db.insert(usersTable).values({
    name: String(name).trim(),
    email: String(email).toLowerCase().trim(),
    passwordHash,
    role: "admin",
    organizationId: org.id,
    isActive: true,
  }).returning();

  // Notify all superadmins by email
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

  const sessionId = createSession(user.id);
  res.setHeader(
    "Set-Cookie",
    `session_id=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`
  );

  const { passwordHash: _, ...safeUser } = user;
  res.status(201).json({ user: safeUser, message: "Registrazione completata" });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  const sessionId = getSessionId(req);
  if (sessionId) {
    destroySession(sessionId);
  }
  res.setHeader("Set-Cookie", "session_id=; Path=/; HttpOnly; Max-Age=0");
  res.json({ success: true, message: "Logout effettuato" });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
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
      phone: usersTable.phone,
      avatarUrl: usersTable.avatarUrl,
      createdAt: usersTable.createdAt,
      isSuperAdmin: usersTable.isSuperAdmin,
    })
    .from(usersTable)
    .leftJoin(organizationsTable, eq(usersTable.organizationId, organizationsTable.id))
    .where(eq(usersTable.id, userId));

  if (!row) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  res.json(row);
});

export default router;
export { hashPassword };
