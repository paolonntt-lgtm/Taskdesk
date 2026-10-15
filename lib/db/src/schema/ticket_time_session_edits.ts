import { pgTable, serial, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";
import { ticketsTable } from "./tickets";
import { ticketTimeSessionsTable } from "./ticket_time_sessions";
import { usersTable } from "./users";

export const ticketTimeSessionEditsTable = pgTable("ticket_time_session_edits", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  ticketId: integer("ticket_id").notNull().references(() => ticketsTable.id, { onDelete: "cascade" }),
  sessionId: integer("session_id").notNull().references(() => ticketTimeSessionsTable.id, { onDelete: "cascade" }),
  collaboratorId: integer("collaborator_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  editedBy: integer("edited_by").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  previousDurationMinutes: integer("previous_duration_minutes").notNull(),
  updatedDurationMinutes: integer("updated_duration_minutes").notNull(),
  previousClientBillable: boolean("previous_client_billable").notNull(),
  updatedClientBillable: boolean("updated_client_billable").notNull(),
  previousCollaboratorRecognizable: boolean("previous_collaborator_recognizable").notNull(),
  updatedCollaboratorRecognizable: boolean("updated_collaborator_recognizable").notNull(),
  editedAt: timestamp("edited_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("ticket_time_session_edits_ticket_idx").on(table.ticketId, table.editedAt),
  index("ticket_time_session_edits_collaborator_idx").on(table.collaboratorId, table.editedAt),
]);

export type TicketTimeSessionEdit = typeof ticketTimeSessionEditsTable.$inferSelect;
