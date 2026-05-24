import { pgTable, serial, integer, text, boolean, timestamp, index, unique } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";

export const ticketStatusesTable = pgTable("ticket_statuses", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizationsTable.id),
  key: text("key").notNull(),
  label: text("label").notNull(),
  color: text("color"),
  sortOrder: integer("sort_order").notNull().default(0),
  isDefault: boolean("is_default").notNull().default(false),
  isClosed: boolean("is_closed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("ticket_statuses_org_key_unique").on(t.organizationId, t.key),
  index("ticket_statuses_org_id_idx").on(t.organizationId),
  index("ticket_statuses_sort_order_idx").on(t.sortOrder),
]);

export type TicketStatus = typeof ticketStatusesTable.$inferSelect;
export type InsertTicketStatus = typeof ticketStatusesTable.$inferInsert;
