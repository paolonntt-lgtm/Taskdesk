import { pgTable, serial, text, integer, boolean, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";
import { usersTable } from "./users";

export const inboundEmailChannelsTable = pgTable("inbound_email_channels", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizationsTable.id),
  label: text("label").notNull().default(""),
  token: text("token").notNull(),
  defaultCategory: text("default_category"),
  defaultGroup: text("default_group"),
  defaultAssignee: integer("default_assignee").references(() => usersTable.id, { onDelete: "set null" }),
  defaultVisibility: text("default_visibility").notNull().default("organization"),
  enabled: boolean("enabled").notNull().default(true),
  slug: text("slug"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  uniqueIndex("inbound_email_channels_token_idx").on(t.token),
  uniqueIndex("inbound_email_channels_slug_idx").on(t.slug),
  index("inbound_email_channels_org_idx").on(t.organizationId),
]);

export type InboundEmailChannel = typeof inboundEmailChannelsTable.$inferSelect;
export type InsertInboundEmailChannel = typeof inboundEmailChannelsTable.$inferInsert;
