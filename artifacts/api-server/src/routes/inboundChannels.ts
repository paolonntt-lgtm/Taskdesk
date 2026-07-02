import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";
import { db, inboundEmailChannelsTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

function generateToken(): string {
  return crypto.randomBytes(8).toString("hex");
}

const SLUG_RE = /^[a-z0-9][a-z0-9_-]{1,38}[a-z0-9]$|^[a-z0-9]{3}$/;

function validateSlug(slug: string): string | null {
  if (!SLUG_RE.test(slug)) {
    return "Lo slug deve essere 3–40 caratteri: solo lettere minuscole, cifre, underscore e trattini.";
  }
  return null;
}

router.get("/settings/inbound-channels", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  if (!orgId) { res.status(404).json({ message: "Organizzazione non trovata" }); return; }

  const channels = await db
    .select()
    .from(inboundEmailChannelsTable)
    .where(eq(inboundEmailChannelsTable.organizationId, orgId));

  const domain = process.env.INBOUND_EMAIL_DOMAIN ?? "inbound.taskdesk.it";
  res.json({ channels, domain });
});

router.post("/settings/inbound-channels", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  if (!orgId) { res.status(404).json({ message: "Organizzazione non trovata" }); return; }

  const { label, defaultCategory, defaultGroup, defaultAssignee, enabled, slug } = req.body ?? {};

  if (!label || typeof label !== "string" || !label.trim()) {
    res.status(400).json({ message: "Etichetta obbligatoria" }); return;
  }

  const cleanSlug = typeof slug === "string" && slug.trim() ? slug.trim().toLowerCase() : null;
  if (cleanSlug) {
    const slugErr = validateSlug(cleanSlug);
    if (slugErr) { res.status(400).json({ message: slugErr }); return; }
    const [clash] = await db.select({ id: inboundEmailChannelsTable.id }).from(inboundEmailChannelsTable)
      .where(eq(inboundEmailChannelsTable.slug, cleanSlug));
    if (clash) { res.status(409).json({ message: "Questo slug è già in uso. Scegline un altro." }); return; }
  }

  let token = generateToken();
  let attempts = 0;
  while (attempts < 5) {
    const [existing] = await db.select().from(inboundEmailChannelsTable)
      .where(eq(inboundEmailChannelsTable.token, token));
    if (!existing) break;
    token = generateToken();
    attempts++;
  }

  const cleanAssignee = typeof defaultAssignee === "number" && defaultAssignee > 0 ? defaultAssignee : null;

  const [channel] = await db.insert(inboundEmailChannelsTable).values({
    organizationId: orgId,
    label: label.trim(),
    token,
    defaultCategory: defaultCategory || null,
    defaultGroup: defaultGroup || null,
    defaultAssignee: cleanAssignee,
    enabled: enabled !== false,
    slug: cleanSlug,
  }).returning();

  res.json({ channel });
});

router.put("/settings/inbound-channels/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  if (!orgId) { res.status(404).json({ message: "Organizzazione non trovata" }); return; }

  const channelId = parseInt(String(req.params.id), 10);
  const [existing] = await db.select().from(inboundEmailChannelsTable)
    .where(and(eq(inboundEmailChannelsTable.id, channelId), eq(inboundEmailChannelsTable.organizationId, orgId)));
  if (!existing) { res.status(404).json({ message: "Canale non trovato" }); return; }

  const { label, defaultCategory, defaultGroup, defaultAssignee, enabled, slug } = req.body ?? {};

  if (!label || typeof label !== "string" || !label.trim()) {
    res.status(400).json({ message: "Etichetta obbligatoria" }); return;
  }

  const cleanSlug = typeof slug === "string" && slug.trim() ? slug.trim().toLowerCase() : null;
  if (cleanSlug) {
    const slugErr = validateSlug(cleanSlug);
    if (slugErr) { res.status(400).json({ message: slugErr }); return; }
    const [clash] = await db.select({ id: inboundEmailChannelsTable.id }).from(inboundEmailChannelsTable)
      .where(and(eq(inboundEmailChannelsTable.slug, cleanSlug), eq(inboundEmailChannelsTable.id, channelId)));
    // Allow the same channel to keep its own slug; only reject if another channel has it
    const [clashOther] = await db.select({ id: inboundEmailChannelsTable.id }).from(inboundEmailChannelsTable)
      .where(eq(inboundEmailChannelsTable.slug, cleanSlug));
    if (clashOther && clashOther.id !== channelId) {
      res.status(409).json({ message: "Questo slug è già in uso. Scegline un altro." }); return;
    }
  }

  const cleanAssignee = typeof defaultAssignee === "number" && defaultAssignee > 0 ? defaultAssignee : null;

  const [updated] = await db.update(inboundEmailChannelsTable).set({
    label: label.trim(),
    defaultCategory: defaultCategory || null,
    defaultGroup: defaultGroup || null,
    defaultAssignee: cleanAssignee,
    enabled: enabled !== false,
    slug: cleanSlug,
    updatedAt: new Date(),
  })
    .where(eq(inboundEmailChannelsTable.id, channelId))
    .returning();

  res.json({ channel: updated });
});

router.delete("/settings/inbound-channels/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  if (!orgId) { res.status(404).json({ message: "Organizzazione non trovata" }); return; }

  const channelId = parseInt(String(req.params.id), 10);
  const [existing] = await db.select().from(inboundEmailChannelsTable)
    .where(and(eq(inboundEmailChannelsTable.id, channelId), eq(inboundEmailChannelsTable.organizationId, orgId)));
  if (!existing) { res.status(404).json({ message: "Canale non trovato" }); return; }

  await db.delete(inboundEmailChannelsTable).where(eq(inboundEmailChannelsTable.id, channelId));

  res.json({ ok: true });
});

router.post("/settings/inbound-channels/:id/regenerate-token", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  if (!orgId) { res.status(404).json({ message: "Organizzazione non trovata" }); return; }

  const channelId = parseInt(String(req.params.id), 10);
  const [existing] = await db.select().from(inboundEmailChannelsTable)
    .where(and(eq(inboundEmailChannelsTable.id, channelId), eq(inboundEmailChannelsTable.organizationId, orgId)));
  if (!existing) { res.status(404).json({ message: "Canale non trovato" }); return; }

  let token = generateToken();
  let attempts = 0;
  while (attempts < 5) {
    const [clash] = await db.select().from(inboundEmailChannelsTable)
      .where(eq(inboundEmailChannelsTable.token, token));
    if (!clash) break;
    token = generateToken();
    attempts++;
  }

  const [updated] = await db.update(inboundEmailChannelsTable).set({ token, updatedAt: new Date() })
    .where(eq(inboundEmailChannelsTable.id, channelId))
    .returning();

  res.json({ channel: updated });
});

router.put("/settings/inbound-channels/:id/toggle", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  if (!orgId) { res.status(404).json({ message: "Organizzazione non trovata" }); return; }

  const channelId = parseInt(String(req.params.id), 10);
  const [existing] = await db.select().from(inboundEmailChannelsTable)
    .where(and(eq(inboundEmailChannelsTable.id, channelId), eq(inboundEmailChannelsTable.organizationId, orgId)));
  if (!existing) { res.status(404).json({ message: "Canale non trovato" }); return; }

  const [updated] = await db.update(inboundEmailChannelsTable).set({
    enabled: !existing.enabled, updatedAt: new Date(),
  })
    .where(eq(inboundEmailChannelsTable.id, channelId))
    .returning();

  res.json({ channel: updated });
});

export default router;
