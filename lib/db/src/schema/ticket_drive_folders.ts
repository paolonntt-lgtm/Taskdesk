import { pgTable, serial, integer, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { ticketsTable } from "./tickets";
import { organizationsTable } from "./organizations";
import { usersTable } from "./users";

export const ticketDriveFoldersTable = pgTable("ticket_drive_folders", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull().references(() => ticketsTable.id, { onDelete: "cascade" }),
  organizationId: integer("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  driveFolderId: text("drive_folder_id").notNull(),
  folderName: text("folder_name").notNull(),
  addedBy: integer("added_by").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("ticket_drive_folders_ticket_org_idx").on(t.ticketId, t.organizationId),
  uniqueIndex("ticket_drive_folders_ticket_drive_folder_idx").on(t.ticketId, t.driveFolderId),
]);

export const insertTicketDriveFolderSchema = createInsertSchema(ticketDriveFoldersTable)
  .omit({ id: true, createdAt: true });
export type InsertTicketDriveFolder = z.infer<typeof insertTicketDriveFolderSchema>;
export type TicketDriveFolder = typeof ticketDriveFoldersTable.$inferSelect;
