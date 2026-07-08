import { pgTable, serial, integer, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";
import { usersTable } from "./users";
import { clientsTable } from "./clients";

export const clientNotesTable = pgTable("client_notes", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  organizationId: integer("organization_id").notNull().references(() => organizationsTable.id),
  authorId: integer("author_id").notNull().references(() => usersTable.id),
  body: text("body").notNull().default(""),
  checklist: jsonb("checklist").$type<Array<{ id: string; text: string; checked: boolean }>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("client_notes_client_idx").on(t.clientId),
  index("client_notes_org_idx").on(t.organizationId),
  index("client_notes_author_idx").on(t.authorId),
]);

export type ClientNote = typeof clientNotesTable.$inferSelect;
