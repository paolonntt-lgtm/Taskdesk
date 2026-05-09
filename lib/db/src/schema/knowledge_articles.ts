import { pgTable, serial, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizationsTable } from "./organizations";
import { usersTable } from "./users";

export const knowledgeArticlesTable = pgTable("knowledge_articles", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizationsTable.id),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category"),
  createdBy: integer("created_by").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("knowledge_articles_org_idx").on(t.organizationId),
  index("knowledge_articles_category_idx").on(t.category),
  index("knowledge_articles_fts_idx").using("gin", sql`to_tsvector('italian', ${t.title} || ' ' || ${t.content})`),
]);

export type KnowledgeArticle = typeof knowledgeArticlesTable.$inferSelect;
