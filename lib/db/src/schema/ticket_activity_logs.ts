import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { ticketsTable } from "./tickets";
import { usersTable } from "./users";

export const ticketActivityLogsTable = pgTable("ticket_activity_logs", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull().references(() => ticketsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  actionType: text("action_type").notNull(),
  actionDescription: text("action_description").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTicketActivityLogSchema = createInsertSchema(ticketActivityLogsTable).omit({ id: true, createdAt: true });
export type InsertTicketActivityLog = z.infer<typeof insertTicketActivityLogSchema>;
export type TicketActivityLog = typeof ticketActivityLogsTable.$inferSelect;
