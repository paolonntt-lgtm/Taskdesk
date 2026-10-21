import { pgTable, serial, text, integer, timestamp, index, jsonb, unique } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";

export const clientsTable = pgTable("clients", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizationsTable.id),
  name: text("name").notNull(),
  alias: text("alias"),
  slug: text("slug"),
  email: text("email"),
  phone: text("phone"),
  vatNumber: text("vat_number"),
  taxCode: text("tax_code"),
  address: text("address"),
  pec: text("pec"),
  contactPerson: text("contact_person"),
  notes: text("notes"),
  notes2: text("notes2"),
  layout: jsonb("layout"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("clients_org_idx").on(t.organizationId),
  index("clients_name_idx").on(t.name),
  index("clients_slug_idx").on(t.slug),
  unique("clients_slug_org_uniq").on(t.organizationId, t.slug),
]);

export type Client = typeof clientsTable.$inferSelect;

export const emailClientSenderRulesTable = pgTable("email_client_sender_rules", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  senderEmail: text("sender_email").notNull(),
  clientId: integer("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("email_client_sender_rules_org_email_uniq").on(t.organizationId, t.senderEmail),
  index("email_client_sender_rules_client_idx").on(t.clientId),
]);

export const emailClientDomainRulesTable = pgTable("email_client_domain_rules", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  domain: text("domain").notNull(),
  clientId: integer("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("email_client_domain_rules_org_domain_uniq").on(t.organizationId, t.domain),
  index("email_client_domain_rules_client_idx").on(t.clientId),
]);
