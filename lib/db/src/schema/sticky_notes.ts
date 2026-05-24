import { pgTable, serial, integer, text, boolean, timestamp, index, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { organizationsTable } from "./organizations";

export const stickyNotesTable = pgTable("sticky_notes", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizationsTable.id),
  createdBy: integer("created_by").notNull().references(() => usersTable.id),
  text: text("text").notNull().default(""),
  color: text("color").notNull().default("yellow"),
  visibility: text("visibility").notNull().default("private"),
  targetGroupName: text("target_group_name"),
  targetUserIds: text("target_user_ids"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("sticky_notes_org_idx").on(t.organizationId),
  index("sticky_notes_created_by_idx").on(t.createdBy),
]);

export const stickyNoteUserStatesTable = pgTable("sticky_note_user_states", {
  id: serial("id").primaryKey(),
  noteId: integer("note_id").notNull().references(() => stickyNotesTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  positionX: integer("position_x").notNull().default(100),
  positionY: integer("position_y").notNull().default(100),
  width: integer("width"),
  height: integer("height"),
  closed: boolean("closed").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  unique("sticky_note_user_uniq").on(t.noteId, t.userId),
]);

export type StickyNote = typeof stickyNotesTable.$inferSelect;
export type StickyNoteUserState = typeof stickyNoteUserStatesTable.$inferSelect;
