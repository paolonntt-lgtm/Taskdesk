import { pgTable, integer, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";
import { usersTable } from "./users";
import { clientsTable } from "./clients";

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

export type OneDriveClientArchive = typeof oneDriveClientArchiveTable.$inferSelect;
export type OneDriveClientFolder = typeof oneDriveClientFoldersTable.$inferSelect;
