import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { createHash } from "crypto";

const router: IRouter = Router();

function hashPassword(password: string): string {
  return createHash("sha256").update(password + "ticketing_salt").digest("hex");
}

const safeFields = {
  id: usersTable.id,
  name: usersTable.name,
  email: usersTable.email,
  role: usersTable.role,
  mainLocation: usersTable.mainLocation,
  phone: usersTable.phone,
  avatarUrl: usersTable.avatarUrl,
  isActive: usersTable.isActive,
  createdAt: usersTable.createdAt,
};

router.patch("/auth/profile", requireAuth, async (req, res): Promise<void> => {
  const current = (req as any).currentUser;
  const { name, email, mainLocation, phone, avatarUrl, currentPassword, newPassword } = req.body ?? {};

  const updates: Record<string, unknown> = {};

  if (name !== undefined) {
    if (typeof name !== "string" || !name.trim()) {
      res.status(400).json({ message: "Il nome non può essere vuoto" });
      return;
    }
    updates.name = name.trim();
  }

  if (email !== undefined) {
    if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      res.status(400).json({ message: "Indirizzo email non valido" });
      return;
    }
    const trimmedEmail = email.trim().toLowerCase();
    if (trimmedEmail !== current.email) {
      const [existing] = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.email, trimmedEmail));
      if (existing) {
        res.status(409).json({ message: "Email già in uso da un altro account" });
        return;
      }
    }
    updates.email = trimmedEmail;
  }

  if (mainLocation !== undefined) {
    updates.mainLocation = mainLocation || null;
  }

  if (phone !== undefined) {
    updates.phone = phone || null;
  }

  if (avatarUrl !== undefined) {
    if (avatarUrl && typeof avatarUrl === "string" && avatarUrl.length > 2_000_000) {
      res.status(400).json({ message: "Immagine troppo grande (max 1.5 MB)" });
      return;
    }
    updates.avatarUrl = avatarUrl || null;
  }

  if (newPassword !== undefined) {
    if (!currentPassword) {
      res.status(400).json({ message: "Inserisci la password attuale per cambiarla" });
      return;
    }
    if (hashPassword(currentPassword) !== current.passwordHash) {
      res.status(401).json({ message: "Password attuale non corretta" });
      return;
    }
    if (typeof newPassword !== "string" || newPassword.length < 6) {
      res.status(400).json({ message: "La nuova password deve essere di almeno 6 caratteri" });
      return;
    }
    updates.passwordHash = hashPassword(newPassword);
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ message: "Nessun campo da aggiornare" });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, current.id))
    .returning(safeFields);

  res.json({ user: updated, message: "Profilo aggiornato con successo" });
});

export default router;
