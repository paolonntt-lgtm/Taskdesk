import { pgTable, serial, text, integer, timestamp, index, jsonb } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";

export const clientsTable = pgTable("clients", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizationsTable.id),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  vatNumber: text("vat_number"),
  taxCode: text("tax_code"),
  address: text("address"),
  pec: text("pec"),
  contactPerson: text("contact_person"),
  notes: text("notes"),
  layout: jsonb("layout"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("clients_org_idx").on(t.organizationId),
  index("clients_name_idx").on(t.name),
]);

export type Client = typeof clientsTable.$inferSelect;
