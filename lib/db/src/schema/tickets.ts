import { pgTable, serial, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { organizationsTable } from "./organizations";

export const ticketsTable = pgTable("tickets", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizationsTable.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  location: text("location").notNull(),
  resource: text("resource"),
  priority: text("priority").notNull().default("medium"),
  status: text("status").notNull().default("open"),
  createdBy: integer("created_by").notNull().references(() => usersTable.id),
  assignedTo: integer("assigned_to").references(() => usersTable.id),
  assignedToGroup: text("assigned_to_group"),
  resolutionNote: text("resolution_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  closedAt: timestamp("closed_at", { withTimezone: true }),
}, (t) => [
  index("tickets_status_idx").on(t.status),
  index("tickets_priority_idx").on(t.priority),
  index("tickets_category_idx").on(t.category),
  index("tickets_location_idx").on(t.location),
  index("tickets_created_by_idx").on(t.createdBy),
  index("tickets_assigned_to_idx").on(t.assignedTo),
  index("tickets_updated_at_idx").on(t.updatedAt),
  index("tickets_organization_id_idx").on(t.organizationId),
]);

export const insertTicketSchema = createInsertSchema(ticketsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTicket = z.infer<typeof insertTicketSchema>;
export type Ticket = typeof ticketsTable.$inferSelect;
