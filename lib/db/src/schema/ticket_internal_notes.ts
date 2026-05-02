import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { ticketsTable } from "./tickets";
import { usersTable } from "./users";

export const ticketInternalNotesTable = pgTable("ticket_internal_notes", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull().references(() => ticketsTable.id, { onDelete: "cascade" }),
  authorId: integer("author_id").notNull().references(() => usersTable.id),
  noteText: text("note_text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTicketInternalNoteSchema = createInsertSchema(ticketInternalNotesTable).omit({ id: true, createdAt: true });
export type InsertTicketInternalNote = z.infer<typeof insertTicketInternalNoteSchema>;
export type TicketInternalNote = typeof ticketInternalNotesTable.$inferSelect;
