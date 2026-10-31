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
  inviteeUserId: integer("invitee_user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  inviteeRole: text("invitee_role").notNull().default("user"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("workspace_invite_tokens_workspace_idx").on(table.workspaceOrganizationId),
  index("workspace_invite_tokens_invitee_idx").on(table.inviteeUserId),
]);

export type WorkspaceInviteToken = typeof workspaceInviteTokensTable.$inferSelect;
