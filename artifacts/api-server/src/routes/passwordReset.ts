import { Router, type IRouter } from "express";
import { eq, and, gt } from "drizzle-orm";
import { randomBytes } from "crypto";
import { db, usersTable, passwordResetTokensTable } from "@workspace/db";
import { hashPassword } from "./auth";
import { destroySessionsForUser } from "../lib/session";
import { sendEmail, buildPasswordResetEmail } from "../lib/email";
import { appBaseUrl } from "../lib/appUrl";
import { logger } from "../lib/logger";
import { forgotPasswordRateLimiter, resetPasswordRateLimiter } from "../lib/rateLimiter";

const router: IRouter = Router();

router.post("/auth/forgot-password", forgotPasswordRateLimiter, async (req, res): Promise<void> => {
  const { email } = req.body ?? {};
  if (!email || typeof email !== "string") {
    res.status(400).json({ message: "Email obbligatoria" });
    return;
  }

  res.json({ message: "Se l'email è registrata, riceverai un link per reimpostare la password." });

  (async () => {
    const [user] = await db
      .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, isActive: usersTable.isActive })
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase().trim()));

    if (!user || !user.isActive) return;

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await db.delete(passwordResetTokensTable)
      .where(and(
        eq(passwordResetTokensTable.userId, user.id),
        eq(passwordResetTokensTable.usedAt, null as any),
      )).catch(() => {});

    await db.insert(passwordResetTokensTable).values({
      userId: user.id,
      token,
      expiresAt,
    });

    const resetUrl = `${appBaseUrl()}/app/reset-password?token=${token}`;
    const { subject, html, text } = buildPasswordResetEmail({
      recipientName: user.name,
      resetUrl,
    });

    const result = await sendEmail({ to: user.email!, subject, html, text });
    if (!result.ok) {
      logger.warn({ userId: user.id, err: result.error }, "Password reset email failed");
    }
  })();
});

router.post("/auth/reset-password", resetPasswordRateLimiter, async (req, res): Promise<void> => {
  const { token, password } = req.body ?? {};

  if (!token || typeof token !== "string") {
    res.status(400).json({ message: "Token mancante" });
    return;
  }
  if (!password || typeof password !== "string" || password.length < 6) {
    res.status(400).json({ message: "La password deve essere di almeno 6 caratteri" });
    return;
  }

  const [resetToken] = await db
    .select()
    .from(passwordResetTokensTable)
    .where(
      and(
        eq(passwordResetTokensTable.token, token),
        eq(passwordResetTokensTable.usedAt, null as any),
        gt(passwordResetTokensTable.expiresAt, new Date()),
      )
    );

  if (!resetToken) {
    res.status(400).json({ message: "Link non valido o scaduto. Richiedi un nuovo link." });
    return;
  }

  const passwordHash = await hashPassword(password);

  await db.update(usersTable)
    .set({ passwordHash })
    .where(eq(usersTable.id, resetToken.userId));

  await db.update(passwordResetTokensTable)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokensTable.id, resetToken.id));

  await destroySessionsForUser(resetToken.userId);

  res.json({ message: "Password aggiornata con successo. Puoi ora accedere con la nuova password." });
});

export default router;
