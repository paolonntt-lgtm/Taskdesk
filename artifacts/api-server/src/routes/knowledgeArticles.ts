import { Router, type IRouter } from "express";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { db, knowledgeArticlesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

const ArticleBody = z.object({
  title: z.string().min(1).max(300),
  content: z.string().min(1),
  category: z.string().max(100).optional().nullable(),
});

router.get("/knowledge-articles", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;

  const articles = await db
    .select()
    .from(knowledgeArticlesTable)
    .where(orgId != null ? eq(knowledgeArticlesTable.organizationId, orgId) : sql`organization_id IS NULL`)
    .orderBy(sql`${knowledgeArticlesTable.updatedAt} DESC`);

  res.json(articles);
});

router.post("/knowledge-articles", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const parsed = ArticleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", message: parsed.error.message });
    return;
  }

  const [article] = await db
    .insert(knowledgeArticlesTable)
    .values({
      title: parsed.data.title,
      content: parsed.data.content,
      category: parsed.data.category ?? null,
      organizationId: currentUser.organizationId,
      createdBy: currentUser.id,
    })
    .returning();

  res.status(201).json(article);
});

router.put("/knowledge-articles/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const parsed = ArticleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", message: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(knowledgeArticlesTable)
    .where(
      and(
        eq(knowledgeArticlesTable.id, id),
        orgId != null ? eq(knowledgeArticlesTable.organizationId, orgId) : sql`organization_id IS NULL`
      )
    );

  if (!existing) {
    res.status(404).json({ error: "Article not found" });
    return;
  }

  const [updated] = await db
    .update(knowledgeArticlesTable)
    .set({
      title: parsed.data.title,
      content: parsed.data.content,
      category: parsed.data.category ?? null,
      updatedAt: new Date(),
    })
    .where(eq(knowledgeArticlesTable.id, id))
    .returning();

  res.json(updated);
});

router.delete("/knowledge-articles/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [existing] = await db
    .select()
    .from(knowledgeArticlesTable)
    .where(
      and(
        eq(knowledgeArticlesTable.id, id),
        orgId != null ? eq(knowledgeArticlesTable.organizationId, orgId) : sql`organization_id IS NULL`
      )
    );

  if (!existing) {
    res.status(404).json({ error: "Article not found" });
    return;
  }

  await db.delete(knowledgeArticlesTable).where(eq(knowledgeArticlesTable.id, id));
  res.status(204).send();
});

export default router;
