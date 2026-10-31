import { pgTable, serial, integer, text, boolean, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";
import { usersTable } from "./users";

export const workspaceMembershipsTable = pgTable("workspace_memberships", {
  id: serial("id").primaryKey(),
  workspaceOrganizationId: integer("workspace_organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("user"),
  permissionOverrides: text("permission_overrides").notNull().default("{}"),
  sponsored: boolean("sponsored").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("workspace_memberships_workspace_user_uniq").on(table.workspaceOrganizationId, table.userId),
  index("workspace_memberships_user_idx").on(table.userId),
]);

export type WorkspaceMembership = typeof workspaceMembershipsTable.$inferSelect;
