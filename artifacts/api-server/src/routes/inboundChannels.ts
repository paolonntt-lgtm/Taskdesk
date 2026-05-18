import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";
import { db, inboundEmailChannelsTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

function generateToken(): string {
  return crypto.randomBytes(8).toString("hex");
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

  const { label, defaultCategory, defaultGroup, enabled } = req.body ?? {};

  if (!label || typeof label !== "string" || !label.trim()) {
    res.status(400).json({ message: "Etichetta obbligatoria" }); return;
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

  const [channel] = await db.insert(inboundEmailChannelsTable).values({
    organizationId: orgId,
    label: label.trim(),
    token,
    defaultCategory: defaultCategory || null,
    defaultGroup: defaultGroup || null,
    enabled: enabled !== false,
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

  const { label, defaultCategory, defaultGroup, enabled } = req.body ?? {};

  if (!label || typeof label !== "string" || !label.trim()) {
    res.status(400).json({ message: "Etichetta obbligatoria" }); return;
  }

  const [updated] = await db.update(inboundEmailChannelsTable).set({
    label: label.trim(),
    defaultCategory: defaultCategory || null,
    defaultGroup: defaultGroup || null,
    enabled: enabled !== false,
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
