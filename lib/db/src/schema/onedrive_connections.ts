import { pgTable, serial, integer, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { organizationsTable } from "./organizations";

export const oneDriveConnectionsTable = pgTable("onedrive_connections", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  organizationId: integer("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  tenantId: text("tenant_id").notNull(),
  microsoftEmail: text("microsoft_email").notNull(),
  encryptedRefreshToken: text("encrypted_refresh_token").notNull(),
  rootFolderId: text("root_folder_id").notNull(),
  operatorFolderId: text("operator_folder_id").notNull(),
  organizationShareUrl: text("organization_share_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  uniqueIndex("onedrive_connections_user_idx").on(t.userId),
  uniqueIndex("onedrive_connections_org_user_idx").on(t.organizationId, t.userId),
]);
