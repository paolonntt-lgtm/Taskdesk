import { pgTable, serial, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";
import { usersTable } from "./users";

export const workspaceInviteTokensTable = pgTable("workspace_invite_tokens", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  workspaceOrganizationId: integer("workspace_organization_id").notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  createdByUserId: integer("created_by_user_id").notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("workspace_invite_tokens_workspace_idx").on(table.workspaceOrganizationId),
]);

export type WorkspaceInviteToken = typeof workspaceInviteTokensTable.$inferSelect;
