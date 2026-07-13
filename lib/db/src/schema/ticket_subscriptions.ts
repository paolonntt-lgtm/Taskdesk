import { pgTable, serial, integer, timestamp, unique, index } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";
import { usersTable } from "./users";
import { ticketsTable } from "./tickets";

export const ticketSubscriptionsTable = pgTable("ticket_subscriptions", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull().references(() => ticketsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  organizationId: integer("organization_id").notNull().references(() => organizationsTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("ticket_subscriptions_unique").on(t.ticketId, t.userId),
  index("ticket_subscriptions_ticket_idx").on(t.ticketId),
  index("ticket_subscriptions_user_idx").on(t.userId),
]);

export type TicketSubscription = typeof ticketSubscriptionsTable.$inferSelect;
