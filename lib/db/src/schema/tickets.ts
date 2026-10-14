import { pgTable, serial, text, integer, timestamp, index, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { organizationsTable } from "./organizations";
import { inboundEmailChannelsTable } from "./inbound_email_channels";
import { clientsTable } from "./clients";

export const ticketsTable = pgTable("tickets", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizationsTable.id),
  ticketNumber: integer("ticket_number"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  location: text("location").notNull(),
  resource: text("resource"),
  priority: text("priority").notNull().default("medium"),
  status: text("status").notNull().default("open"),
  visibility: text("visibility").notNull().default("organization"),
  createdBy: integer("created_by").notNull().references(() => usersTable.id),
  assignedTo: integer("assigned_to").references(() => usersTable.id),
  assignedToGroup: text("assigned_to_group"),
  resolutionNote: text("resolution_note"),
  workedMinutes: integer("worked_minutes"),
  workedBillingStatus: text("worked_billing_status").notNull().default("unbilled"),
  timeTrackingEnabled: boolean("time_tracking_enabled").notNull().default(false),
  timeTrackingBillable: boolean("time_tracking_billable").notNull().default(false),
  timeTrackingCompensationOverride: boolean("time_tracking_compensation_override"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  emailMessageId: text("email_message_id"),
  emailConversationId: text("email_conversation_id"),
  inboundChannelId: integer("inbound_channel_id").references(() => inboundEmailChannelsTable.id),
  clientId: integer("client_id").references(() => clientsTable.id),
  recurrenceRule: jsonb("recurrence_rule"),
  recurrenceNextAt: timestamp("recurrence_next_at", { withTimezone: true }),
  recurrenceParentId: integer("recurrence_parent_id").references((): any => ticketsTable.id),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
}, (t) => [
  index("tickets_status_idx").on(t.status),
  index("tickets_priority_idx").on(t.priority),
  index("tickets_category_idx").on(t.category),
  index("tickets_location_idx").on(t.location),
  index("tickets_created_by_idx").on(t.createdBy),
  index("tickets_assigned_to_idx").on(t.assignedTo),
  index("tickets_updated_at_idx").on(t.updatedAt),
  index("tickets_deleted_at_idx").on(t.organizationId, t.deletedAt),
  index("tickets_organization_id_idx").on(t.organizationId),
  index("tickets_email_message_id_idx").on(t.emailMessageId),
  index("tickets_email_conversation_id_idx").on(t.emailConversationId),
]);

export const insertTicketSchema = createInsertSchema(ticketsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTicket = z.infer<typeof insertTicketSchema>;
export type Ticket = typeof ticketsTable.$inferSelect;
