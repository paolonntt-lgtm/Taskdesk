import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, settingsTable, organizationsTable, usersTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { stripeService } from "../stripeService";
import { type SmtpConfig } from "../lib/email";

const router: IRouter = Router();

const DEFAULT_LOCATIONS = ["Main office"];
export const STANDARD_CATEGORIES = [
  "PC",
  "Printer",
  "Internet / Network",
  "Software",
  "Telephony",
  "Cash register / ERP",
  "Other",
];
const DEFAULT_CATEGORIES = STANDARD_CATEGORIES;
const DEFAULT_GROUPS = ["IT Support", "Reception", "Administration"];
export { DEFAULT_LOCATIONS };

function orgKey(orgId: number | null | undefined, base: string): string {
  return orgId != null ? `org_${orgId}_${base}` : base;
}

async function getSetting(key: string, defaultValue: string[]): Promise<string[]> {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
  if (!row) return defaultValue;
  try {
    return JSON.parse(row.value);
  } catch {
    return defaultValue;
  }
}

router.get("/settings/locations", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const key = orgKey(currentUser.organizationId, "locations");
  const value = await getSetting(key, DEFAULT_LOCATIONS);
  res.json({ value });
});

router.get("/settings/categories", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const key = orgKey(currentUser.organizationId, "categories");
  const value = await getSetting(key, DEFAULT_CATEGORIES);
  const sorted = [...value].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  res.json({ value: sorted });
});

router.get("/settings/default-category", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const key = orgKey(currentUser.organizationId, "default_category");
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
  const value = row ? row.value : null;
  res.json({ value });
});

router.put("/settings/default-category", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { value } = req.body ?? {};
  if (value !== null && typeof value !== "string") {
    res.status(400).json({ message: "Valore non valido" });
    return;
  }
  const currentUser = (req as any).currentUser;
  const key = orgKey(currentUser.organizationId, "default_category");
  if (!value) {
    await db.delete(settingsTable).where(eq(settingsTable.key, key));
    res.json({ value: null });
    return;
  }
  await db
    .insert(settingsTable)
    .values({ key, value })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value } });
  res.json({ value });
});

router.put("/settings/locations", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { value } = req.body ?? {};
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) {
    res.status(400).json({ message: "Valore non valido: deve essere un array di stringhe" });
    return;
  }
  const currentUser = (req as any).currentUser;
  const key = orgKey(currentUser.organizationId, "locations");
  const cleaned = value.map((v: string) => v.trim()).filter(Boolean);
  await db
    .insert(settingsTable)
    .values({ key, value: JSON.stringify(cleaned) })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value: JSON.stringify(cleaned) } });
  res.json({ value: cleaned });
});

router.put("/settings/categories", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { value } = req.body ?? {};
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) {
    res.status(400).json({ message: "Valore non valido: deve essere un array di stringhe" });
    return;
  }
  const currentUser = (req as any).currentUser;
  const key = orgKey(currentUser.organizationId, "categories");
  const cleaned = value.map((v: string) => v.trim()).filter(Boolean);
  const sorted = [...cleaned].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  await db
    .insert(settingsTable)
    .values({ key, value: JSON.stringify(sorted) })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value: JSON.stringify(sorted) } });
  res.json({ value: sorted });
});

router.get("/settings/groups", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const key = orgKey(currentUser.organizationId, "groups");
  const value = await getSetting(key, DEFAULT_GROUPS);
  res.json({ value });
});

router.put("/settings/groups", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { value } = req.body ?? {};
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) {
    res.status(400).json({ message: "Valore non valido: deve essere un array di stringhe" });
    return;
  }
  const currentUser = (req as any).currentUser;
  const key = orgKey(currentUser.organizationId, "groups");
  const cleaned = value.map((v: string) => v.trim()).filter(Boolean);
  await db
    .insert(settingsTable)
    .values({ key, value: JSON.stringify(cleaned) })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value: JSON.stringify(cleaned) } });
  res.json({ value: cleaned });
});

// Group permissions: { [groupName]: string[] } where permissions are "change_status" | "add_notes"
router.get("/settings/group-permissions", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const key = orgKey(currentUser.organizationId, "group_permissions");
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
  let value: Record<string, string[]> = {};
  if (row) {
    try { value = JSON.parse(row.value); } catch { value = {}; }
  }
  res.json({ value });
});

router.put("/settings/group-permissions", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { value } = req.body ?? {};
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    res.status(400).json({ message: "Valore non valido: deve essere un oggetto { gruppo: permessi[] }" });
    return;
  }
  const VALID_PERMS = new Set(["change_status", "add_notes"]);
  for (const [k, v] of Object.entries(value)) {
    if (typeof k !== "string" || !Array.isArray(v) || (v as any[]).some((p) => !VALID_PERMS.has(p))) {
      res.status(400).json({ message: `Permessi non validi per il gruppo "${k}"` });
      return;
    }
  }
  const currentUser = (req as any).currentUser;
  const key = orgKey(currentUser.organizationId, "group_permissions");
  await db
    .insert(settingsTable)
    .values({ key, value: JSON.stringify(value) })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value: JSON.stringify(value) } });
  res.json({ value });
});

router.get("/settings/billing", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  if (!currentUser.organizationId) { res.status(404).json({ message: "Organizzazione non trovata" }); return; }
  const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, currentUser.organizationId));
  if (!org) { res.status(404).json({ message: "Organizzazione non trovata" }); return; }
  res.json({
    ragioneSociale: org.ragioneSociale,
    piva: org.piva,
    codiceFiscale: org.codiceFiscale,
    indirizzo: org.indirizzo,
    cap: org.cap,
    citta: org.citta,
    provincia: org.provincia,
    paese: org.paese,
    sdiCode: org.sdiCode,
    pec: org.pec,
  });
});

router.put("/settings/billing", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  if (!currentUser.organizationId) { res.status(404).json({ message: "Organizzazione non trovata" }); return; }

  const { ragioneSociale, piva, codiceFiscale, indirizzo, cap, citta, provincia, paese, sdiCode, pec } = req.body ?? {};

  const [updated] = await db
    .update(organizationsTable)
    .set({
      ragioneSociale: ragioneSociale || null,
      piva: piva || null,
      codiceFiscale: codiceFiscale || null,
      indirizzo: indirizzo || null,
      cap: cap || null,
      citta: citta || null,
      provincia: provincia || null,
      paese: paese || 'IT',
      sdiCode: sdiCode || null,
      pec: pec || null,
    })
    .where(eq(organizationsTable.id, currentUser.organizationId))
    .returning();

  // Sync to Stripe: find admin users of this org who have a Stripe customer
  try {
    const adminUsers = await db
      .select({ stripeCustomerId: usersTable.stripeCustomerId })
      .from(usersTable)
      .where(and(eq(usersTable.organizationId, currentUser.organizationId), eq(usersTable.role, 'admin')));

    const billingInfo = {
      ragioneSociale: updated.ragioneSociale,
      piva: updated.piva,
      codiceFiscale: updated.codiceFiscale,
      indirizzo: updated.indirizzo,
      cap: updated.cap,
      citta: updated.citta,
      provincia: updated.provincia,
      paese: updated.paese,
      sdiCode: updated.sdiCode,
      pec: updated.pec,
    };

    await Promise.allSettled(
      adminUsers
        .filter((u) => !!u.stripeCustomerId)
        .map((u) => stripeService.updateCustomerBilling(u.stripeCustomerId!, billingInfo))
    );
  } catch {
    // Stripe sync failure should not block saving
  }

  res.json({
    ragioneSociale: updated.ragioneSociale,
    piva: updated.piva,
    codiceFiscale: updated.codiceFiscale,
    indirizzo: updated.indirizzo,
    cap: updated.cap,
    citta: updated.citta,
    provincia: updated.provincia,
    paese: updated.paese,
    sdiCode: updated.sdiCode,
    pec: updated.pec,
  });
});

const VALID_BUSINESS_TYPES = ["it_support", "professional_studio", "agency", "other"];

router.get("/settings/organization", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  if (!currentUser.organizationId) {
    res.status(404).json({ message: "Organizzazione non trovata" });
    return;
  }
  const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, currentUser.organizationId));
  if (!org) {
    res.status(404).json({ message: "Organizzazione non trovata" });
    return;
  }
  res.json({ name: org.name, businessType: org.businessType, clientsEnabled: org.clientsEnabled });
});

router.patch("/settings/organization", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { name, businessType, clientsEnabled } = req.body ?? {};
  if (typeof name !== "string" || name.trim().length < 2) {
    res.status(400).json({ message: "Il nome azienda deve avere almeno 2 caratteri" });
    return;
  }
  if (businessType !== undefined && businessType !== null && !VALID_BUSINESS_TYPES.includes(businessType)) {
    res.status(400).json({ message: "Tipo di attività non valido" });
    return;
  }
  const currentUser = (req as any).currentUser;
  if (!currentUser.organizationId) {
    res.status(404).json({ message: "Organizzazione non trovata" });
    return;
  }
  const updateData: Record<string, unknown> = { name: name.trim() };
  if (businessType !== undefined) updateData.businessType = businessType || null;
  if (typeof clientsEnabled === "boolean") updateData.clientsEnabled = clientsEnabled;
  const [updated] = await db
    .update(organizationsTable)
    .set(updateData as any)
    .where(eq(organizationsTable.id, currentUser.organizationId))
    .returning();
  res.json({ name: updated.name, businessType: updated.businessType, clientsEnabled: updated.clientsEnabled });
});

// ── CLIENT SHARED LAYOUT ───────────────────────────────────────────────────

router.get("/settings/client-layout", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  if (!currentUser.organizationId) { res.status(404).json({ message: "Organizzazione non trovata" }); return; }
  const [org] = await db.select({ clientSharedLayout: organizationsTable.clientSharedLayout })
    .from(organizationsTable)
    .where(eq(organizationsTable.id, currentUser.organizationId));
  if (!org) { res.status(404).json({ message: "Organizzazione non trovata" }); return; }
  res.json({ layout: org.clientSharedLayout ?? null });
});

router.patch("/settings/client-layout", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { layout } = req.body ?? {};
  if (!Array.isArray(layout)) { res.status(400).json({ message: "Layout non valido" }); return; }

  const VALID_BUILTIN_IDS = new Set(["company-info", "fixed-notes", "client-notes", "linked-tickets"]);
  const normalized: Array<{
    id: string;
    instanceId: string;
    type?: string;
    visible: boolean;
    customName?: string;
  }> = [];

  for (const item of layout) {
    if (typeof item !== "object" || item === null) {
      res.status(400).json({ message: "Ogni elemento del layout deve essere un oggetto" }); return;
    }
    const instanceId: string = typeof item.instanceId === "string" ? item.instanceId
      : typeof item.id === "string" ? item.id : "";
    if (!instanceId) {
      res.status(400).json({ message: "Ogni elemento del layout deve avere un instanceId" }); return;
    }
    if (typeof item.visible !== "boolean") {
      res.status(400).json({ message: `Campo 'visible' mancante o non booleano per ${instanceId}` }); return;
    }
    const id: string = typeof item.id === "string" ? item.id : instanceId;
    const type: string | undefined = typeof item.type === "string" ? item.type : undefined;
    const customName: string | undefined =
      typeof item.customName === "string" && item.customName.trim()
        ? item.customName.trim().slice(0, 100)
        : undefined;

    if (!VALID_BUILTIN_IDS.has(instanceId) && !type) {
      res.status(400).json({ message: `Tipo mancante per il blocco personalizzato ${instanceId}` }); return;
    }

    normalized.push({ id, instanceId, ...(type ? { type } : {}), visible: item.visible, ...(customName ? { customName } : {}) });
  }

  const currentUser = (req as any).currentUser;
  if (!currentUser.organizationId) { res.status(404).json({ message: "Organizzazione non trovata" }); return; }
  await db.update(organizationsTable)
    .set({ clientSharedLayout: normalized } as any)
    .where(eq(organizationsTable.id, currentUser.organizationId));
  res.json({ layout: normalized });
});

// ── OUTBOUND EMAIL (SMTP) ──────────────────────────────────────────────────

router.get("/settings/outbound-email", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  if (!orgId) { res.status(404).json({ message: "Organizzazione non trovata" }); return; }

  const key = `org_${orgId}_smtp_config`;
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
  if (!row) { res.json({ config: null }); return; }

  let config: SmtpConfig;
  try { config = JSON.parse(row.value); } catch { res.json({ config: null }); return; }

  res.json({
    config: { host: config.host, port: config.port, secure: config.secure, user: config.user, password: "***", from: config.from },
  });
});

router.put("/settings/outbound-email", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  if (!orgId) { res.status(404).json({ message: "Organizzazione non trovata" }); return; }

  const { host, port, secure, user, password, from } = req.body ?? {};
  if (!host || typeof host !== "string") { res.status(400).json({ message: "Host SMTP obbligatorio" }); return; }
  if (!user || typeof user !== "string") { res.status(400).json({ message: "Utente SMTP obbligatorio" }); return; }
  if (!from || typeof from !== "string") { res.status(400).json({ message: "Indirizzo mittente obbligatorio" }); return; }

  const key = `org_${orgId}_smtp_config`;
  const [existing] = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
  let existingPassword = "";
  if (existing) {
    try { existingPassword = (JSON.parse(existing.value) as SmtpConfig).password ?? ""; } catch {}
  }

  const resolvedPassword = (typeof password === "string" && password !== "***" && password.length > 0)
    ? password : existingPassword;
  if (!resolvedPassword) { res.status(400).json({ message: "Password SMTP obbligatoria" }); return; }

  const config: SmtpConfig = {
    host: host.trim(),
    port: typeof port === "number" ? port : parseInt(String(port), 10) || 587,
    secure: secure === true,
    user: user.trim(),
    password: resolvedPassword,
    from: from.trim(),
  };

  await db.insert(settingsTable).values({ key, value: JSON.stringify(config) })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value: JSON.stringify(config) } });

  res.json({ config: { ...config, password: "***" } });
});

router.post("/settings/outbound-email/test", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  if (!orgId) { res.status(404).json({ message: "Organizzazione non trovata" }); return; }

  const { host, port, secure, user, password, from } = req.body ?? {};
  if (!host || !user) { res.status(400).json({ message: "Host e utente SMTP obbligatori" }); return; }

  let resolvedPassword = password;
  if (!resolvedPassword || resolvedPassword === "***") {
    const key = `org_${orgId}_smtp_config`;
    const [existing] = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
    if (existing) {
      try { resolvedPassword = (JSON.parse(existing.value) as SmtpConfig).password; } catch {}
    }
  }
  if (!resolvedPassword) { res.status(400).json({ message: "Password obbligatoria per il test" }); return; }

  try {
    const nodemailerMod = await import("nodemailer");
    const transporter = nodemailerMod.default.createTransport({
      host: String(host).trim(),
      port: typeof port === "number" ? port : parseInt(String(port), 10) || 587,
      secure: secure === true,
      auth: { user: String(user).trim(), pass: resolvedPassword },
    });
    await transporter.verify();
    await transporter.sendMail({
      from: from || user,
      to: currentUser.email!,
      subject: "TaskDesk — Test email uscente SMTP",
      text: `Configurazione SMTP verificata per ${user}. Messaggio automatico di test.`,
      html: `<p>Configurazione SMTP verificata per <strong>${user}</strong>.</p><p>Messaggio automatico di test da <strong>TaskDesk</strong>.</p>`,
    });
    res.json({ ok: true });
  } catch (err: any) {
    res.json({ ok: false, error: err?.message ?? "Connessione fallita" });
  }
});

export default router;
