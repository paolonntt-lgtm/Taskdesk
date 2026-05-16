import { pgTable, serial, text, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";

export const emailChannelsTable = pgTable("email_channels", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizationsTable.id),
  type: text("type").notNull(), // 'smtp' | 'imap'
  label: text("label").notNull().default(""),
  host: text("host").notNull().default(""),
  port: integer("port").notNull().default(993),
  secure: boolean("secure").notNull().default(true),
  user: text("user").notNull().default(""),
  password: text("password").notNull().default(""),
  fromAddress: text("from_address"),
  folder: text("folder").default("INBOX"),
  defaultCategory: text("default_category"),
  defaultGroup: text("default_group"),
  isPrimary: boolean("is_primary").notNull().default(false),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("email_channels_org_type_idx").on(t.organizationId, t.type),
  index("email_channels_org_idx").on(t.organizationId),
]);

export type EmailChannel = typeof emailChannelsTable.$inferSelect;
export type InsertEmailChannel = typeof emailChannelsTable.$inferInsert;
