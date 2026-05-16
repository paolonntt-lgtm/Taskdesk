import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, emailChannelsTable, settingsTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { testImapConnection, baselineMailboxById, getChannelImapStatus } from "../lib/emailPoller";
import { migrateEmailChannels } from "../lib/migrateEmailChannels";
import nodemailer from "nodemailer";

const router: IRouter = Router();

router.get("/settings/email-channels", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  if (!orgId) { res.status(404).json({ message: "Organizzazione non trovata" }); return; }

  await migrateEmailChannels();

  const channels = await db
    .select()
    .from(emailChannelsTable)
    .where(eq(emailChannelsTable.organizationId, orgId));

  const channelsWithStatus = await Promise.all(
    channels.map(async (ch) => {
      const status = ch.type === "imap" ? await getChannelImapStatus(ch.id) : null;
      return { ...ch, password: "***", status };
    })
  );

  res.json({ channels: channelsWithStatus });
});

router.post("/settings/email-channels", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  if (!orgId) { res.status(404).json({ message: "Organizzazione non trovata" }); return; }

  const { type, label, host, port, secure, user, password, fromAddress, folder, defaultCategory, defaultGroup, isPrimary, enabled } = req.body ?? {};

  if (!type || (type !== "smtp" && type !== "imap")) {
    res.status(400).json({ message: "Tipo canale non valido (smtp o imap)" }); return;
  }
  if (!host || typeof host !== "string") { res.status(400).json({ message: "Host obbligatorio" }); return; }
  if (!user || typeof user !== "string") { res.status(400).json({ message: "Utente/email obbligatorio" }); return; }
  if (!password || typeof password !== "string") { res.status(400).json({ message: "Password obbligatoria" }); return; }

  if (type === "smtp" && isPrimary) {
    await db.update(emailChannelsTable)
      .set({ isPrimary: false })
      .where(and(eq(emailChannelsTable.organizationId, orgId), eq(emailChannelsTable.type, "smtp")));
  }

  const [channel] = await db.insert(emailChannelsTable).values({
    organizationId: orgId,
    type,
    label: (label && label.trim()) ? label.trim() : user.trim(),
    host: host.trim(),
    port: typeof port === "number" ? port : parseInt(String(port), 10) || (type === "smtp" ? 587 : 993),
    secure: secure === true || secure === "true",
    user: user.trim(),
    password,
    fromAddress: (fromAddress && fromAddress.trim()) ? fromAddress.trim() : null,
    folder: (folder && folder.trim()) ? folder.trim() : "INBOX",
    defaultCategory: defaultCategory || null,
    defaultGroup: defaultGroup || null,
    isPrimary: type === "smtp" ? (isPrimary === true) : false,
    enabled: enabled !== false,
  }).returning();

  if (type === "imap" && channel.enabled) {
    baselineMailboxById(channel.id, {
      host: channel.host, port: channel.port, secure: channel.secure,
      user: channel.user, password, enabled: channel.enabled,
      folder: channel.folder ?? "INBOX",
    }).catch((err) => req.log.warn({ err, channelId: channel.id }, "Baseline mailbox failed after create"));
  }

  res.json({ channel: { ...channel, password: "***" } });
});

router.put("/settings/email-channels/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  if (!orgId) { res.status(404).json({ message: "Organizzazione non trovata" }); return; }

  const channelId = parseInt(String(req.params.id), 10);
  const [existing] = await db.select().from(emailChannelsTable)
    .where(and(eq(emailChannelsTable.id, channelId), eq(emailChannelsTable.organizationId, orgId)));
  if (!existing) { res.status(404).json({ message: "Canale non trovato" }); return; }

  const { label, host, port, secure, user, password, fromAddress, folder, defaultCategory, defaultGroup, isPrimary, enabled } = req.body ?? {};

  if (!host || typeof host !== "string") { res.status(400).json({ message: "Host obbligatorio" }); return; }
  if (!user || typeof user !== "string") { res.status(400).json({ message: "Utente/email obbligatorio" }); return; }

  const resolvedPassword = (typeof password === "string" && password !== "***" && password.length > 0)
    ? password
    : existing.password;
  if (!resolvedPassword) { res.status(400).json({ message: "Password obbligatoria" }); return; }

  if (existing.type === "smtp" && isPrimary) {
    await db.update(emailChannelsTable)
      .set({ isPrimary: false })
      .where(and(eq(emailChannelsTable.organizationId, orgId), eq(emailChannelsTable.type, "smtp")));
  }

  const credentialsChanged = existing.host !== host.trim() || existing.user !== user.trim() || existing.password !== resolvedPassword;

  const [updated] = await db.update(emailChannelsTable).set({
    label: (label && label.trim()) ? label.trim() : user.trim(),
    host: host.trim(),
    port: typeof port === "number" ? port : parseInt(String(port), 10) || existing.port,
    secure: secure === true || secure === "true",
    user: user.trim(),
    password: resolvedPassword,
    fromAddress: (fromAddress && fromAddress.trim()) ? fromAddress.trim() : null,
    folder: (folder && folder.trim()) ? folder.trim() : "INBOX",
    defaultCategory: defaultCategory || null,
    defaultGroup: defaultGroup || null,
    isPrimary: existing.type === "smtp" ? (isPrimary === true) : false,
    enabled: enabled !== false,
    updatedAt: new Date(),
  })
    .where(eq(emailChannelsTable.id, channelId))
    .returning();

  if (updated.type === "imap" && updated.enabled && credentialsChanged) {
    baselineMailboxById(updated.id, {
      host: updated.host, port: updated.port, secure: updated.secure,
      user: updated.user, password: resolvedPassword, enabled: updated.enabled,
      folder: updated.folder ?? "INBOX",
    }).catch((err) => req.log.warn({ err, channelId: updated.id }, "Baseline mailbox failed after update"));
  }

  res.json({ channel: { ...updated, password: "***" } });
});

router.delete("/settings/email-channels/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  if (!orgId) { res.status(404).json({ message: "Organizzazione non trovata" }); return; }

  const channelId = parseInt(String(req.params.id), 10);
  const [existing] = await db.select().from(emailChannelsTable)
    .where(and(eq(emailChannelsTable.id, channelId), eq(emailChannelsTable.organizationId, orgId)));
  if (!existing) { res.status(404).json({ message: "Canale non trovato" }); return; }

  await db.delete(emailChannelsTable).where(eq(emailChannelsTable.id, channelId));

  const statusKey = `email_channel_${channelId}_status`;
  await db.delete(settingsTable).where(eq(settingsTable.key, statusKey)).catch(() => {});

  res.json({ ok: true });
});

router.post("/settings/email-channels/:id/test", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  if (!orgId) { res.status(404).json({ message: "Organizzazione non trovata" }); return; }

  const channelId = parseInt(String(req.params.id), 10);
  const [channel] = await db.select().from(emailChannelsTable)
    .where(and(eq(emailChannelsTable.id, channelId), eq(emailChannelsTable.organizationId, orgId)));
  if (!channel) { res.status(404).json({ message: "Canale non trovato" }); return; }

  if (channel.type === "imap") {
    const result = await testImapConnection({
      host: channel.host, port: channel.port, secure: channel.secure,
      user: channel.user, password: channel.password, enabled: true,
      folder: channel.folder ?? "INBOX",
    });
    res.json(result);
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: channel.host, port: channel.port, secure: channel.secure,
      auth: { user: channel.user, pass: channel.password },
    });
    await transporter.verify();
    await transporter.sendMail({
      from: channel.fromAddress || channel.user,
      to: currentUser.email!,
      subject: "TaskDesk — Test email uscente SMTP",
      text: `Configurazione SMTP verificata per ${channel.user}. Messaggio automatico di test.`,
      html: `<p>Configurazione SMTP verificata per <strong>${channel.user}</strong>.</p><p>Messaggio automatico di test da <strong>TaskDesk</strong>.</p>`,
    });
    res.json({ ok: true });
  } catch (err: any) {
    res.json({ ok: false, error: err?.message ?? "Connessione fallita" });
  }
});

router.put("/settings/email-channels/:id/primary", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  if (!orgId) { res.status(404).json({ message: "Organizzazione non trovata" }); return; }

  const channelId = parseInt(String(req.params.id), 10);
  const [channel] = await db.select().from(emailChannelsTable)
    .where(and(eq(emailChannelsTable.id, channelId), eq(emailChannelsTable.organizationId, orgId)));
  if (!channel) { res.status(404).json({ message: "Canale non trovato" }); return; }
  if (channel.type !== "smtp") { res.status(400).json({ message: "Solo i canali SMTP possono essere primari" }); return; }

  await db.update(emailChannelsTable)
    .set({ isPrimary: false })
    .where(and(eq(emailChannelsTable.organizationId, orgId), eq(emailChannelsTable.type, "smtp")));
  await db.update(emailChannelsTable)
    .set({ isPrimary: true })
    .where(eq(emailChannelsTable.id, channelId));

  res.json({ ok: true });
});

router.put("/settings/email-channels/:id/toggle", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  if (!orgId) { res.status(404).json({ message: "Organizzazione non trovata" }); return; }

  const channelId = parseInt(String(req.params.id), 10);
  const [channel] = await db.select().from(emailChannelsTable)
    .where(and(eq(emailChannelsTable.id, channelId), eq(emailChannelsTable.organizationId, orgId)));
  if (!channel) { res.status(404).json({ message: "Canale non trovato" }); return; }

  const [updated] = await db.update(emailChannelsTable)
    .set({ enabled: !channel.enabled, updatedAt: new Date() })
    .where(eq(emailChannelsTable.id, channelId))
    .returning();

  res.json({ channel: { ...updated, password: "***" } });
});

export default router;
