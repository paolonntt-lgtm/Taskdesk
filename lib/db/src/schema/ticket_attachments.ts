import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { ticketsTable } from "./tickets";
import { ticketCommentsTable } from "./ticket_comments";
import { usersTable } from "./users";

export const ticketAttachmentsTable = pgTable("ticket_attachments", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull().references(() => ticketsTable.id, { onDelete: "cascade" }),
  commentId: integer("comment_id").references(() => ticketCommentsTable.id, { onDelete: "cascade" }),
  uploadedBy: integer("uploaded_by").notNull().references(() => usersTable.id),
  objectPath: text("object_path").notNull(),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: text("mime_type").notNull(),
  oneDriveItemId: text("onedrive_item_id"),
  oneDriveSyncError: text("onedrive_sync_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("ticket_attachments_ticket_id_idx").on(t.ticketId),
  index("ticket_attachments_comment_id_idx").on(t.commentId),
]);

export const insertTicketAttachmentSchema = createInsertSchema(ticketAttachmentsTable).omit({ id: true, createdAt: true });
export type InsertTicketAttachment = z.infer<typeof insertTicketAttachmentSchema>;
export type TicketAttachment = typeof ticketAttachmentsTable.$inferSelect;
