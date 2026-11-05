import { pgTable, integer, serial, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";
import { usersTable } from "./users";
import { clientsTable } from "./clients";
import { ticketAttachmentsTable } from "./ticket_attachments";

export const oneDriveClientArchiveTable = pgTable("onedrive_client_archives", {
  organizationId: integer("organization_id").primaryKey().references(() => organizationsTable.id, { onDelete: "cascade" }),
  ownerUserId: integer("owner_user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  clientsFolderId: text("clients_folder_id").notNull(),
  clientsFolderUrl: text("clients_folder_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const oneDriveClientFoldersTable = pgTable("onedrive_client_folders", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  clientId: integer("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  driveItemId: text("drive_item_id").notNull(),
  folderName: text("folder_name").notNull(),
  webUrl: text("web_url").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  uniqueIndex("onedrive_client_folders_org_client_idx").on(t.organizationId, t.clientId),
]);

export const oneDriveClientArchiveBackfillItemsTable = pgTable("onedrive_client_archive_backfill_items", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  attachmentId: integer("attachment_id").notNull().references(() => ticketAttachmentsTable.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("queued"),
  attempts: integer("attempts").notNull().default(0),
  copyName: text("copy_name"),
  lastError: text("last_error"),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  uniqueIndex("onedrive_client_archive_backfill_org_attachment_idx").on(t.organizationId, t.attachmentId),
  index("onedrive_client_archive_backfill_status_retry_idx").on(t.status, t.nextAttemptAt),
]);

export type OneDriveClientArchive = typeof oneDriveClientArchiveTable.$inferSelect;
export type OneDriveClientFolder = typeof oneDriveClientFoldersTable.$inferSelect;
export type OneDriveClientArchiveBackfillItem = typeof oneDriveClientArchiveBackfillItemsTable.$inferSelect;
