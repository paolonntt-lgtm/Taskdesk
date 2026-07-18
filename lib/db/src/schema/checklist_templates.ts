import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";

export const checklistTemplatesTable = pgTable("checklist_templates", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  category: text("category"),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("checklist_templates_org_id_idx").on(t.orgId),
  index("checklist_templates_category_idx").on(t.category),
]);

export const checklistTemplateItemsTable = pgTable("checklist_template_items", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id").notNull().references(() => checklistTemplatesTable.id, { onDelete: "cascade" }),
  orgId: integer("org_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("checklist_template_items_template_id_idx").on(t.templateId),
]);

export type ChecklistTemplate = typeof checklistTemplatesTable.$inferSelect;
export type ChecklistTemplateItem = typeof checklistTemplateItemsTable.$inferSelect;
