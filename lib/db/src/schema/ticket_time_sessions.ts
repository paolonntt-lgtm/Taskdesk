import { pgTable, serial, integer, timestamp, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { ticketsTable } from "./tickets";
import { usersTable } from "./users";
import { organizationsTable } from "./organizations";

export const ticketTimeSessionsTable = pgTable("ticket_time_sessions", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  ticketId: integer("ticket_id").notNull().references(() => ticketsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  clientBillable: boolean("client_billable").notNull().default(false),
  collaboratorRecognizable: boolean("collaborator_recognizable").notNull().default(false),
  collaboratorInvoiceReceived: boolean("collaborator_invoice_received").notNull().default(false),
}, (table) => [
  index("ticket_time_sessions_org_started_idx").on(table.organizationId, table.startedAt),
  index("ticket_time_sessions_ticket_idx").on(table.ticketId, table.startedAt),
  index("ticket_time_sessions_user_idx").on(table.userId, table.startedAt),
  uniqueIndex("ticket_time_sessions_one_active_per_user").on(table.userId).where(sql`${table.endedAt} IS NULL`),
]);

export type TicketTimeSession = typeof ticketTimeSessionsTable.$inferSelect;
export type InsertTicketTimeSession = typeof ticketTimeSessionsTable.$inferInsert;
