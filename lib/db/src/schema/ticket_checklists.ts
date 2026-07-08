import { pgTable, serial, integer, text, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { ticketsTable } from "./tickets";
import { organizationsTable } from "./organizations";

export const ticketChecklistsTable = pgTable("ticket_checklists", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull().references(() => ticketsTable.id, { onDelete: "cascade" }),
  orgId: integer("org_id").references(() => organizationsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("ticket_checklists_ticket_id_idx").on(t.ticketId),
]);

export const ticketChecklistItemsTable = pgTable("ticket_checklist_items", {
  id: serial("id").primaryKey(),
  checklistId: integer("checklist_id").notNull().references(() => ticketChecklistsTable.id, { onDelete: "cascade" }),
  orgId: integer("org_id").references(() => organizationsTable.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  checked: boolean("checked").notNull().default(false),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("ticket_checklist_items_checklist_id_idx").on(t.checklistId),
]);

export type TicketChecklist = typeof ticketChecklistsTable.$inferSelect;
export type TicketChecklistItem = typeof ticketChecklistItemsTable.$inferSelect;
