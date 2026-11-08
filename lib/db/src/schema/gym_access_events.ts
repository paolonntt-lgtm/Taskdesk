import { createInsertSchema } from "drizzle-zod";
import { index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";
import { organizationsTable } from "./organizations";
import { usersTable } from "./users";

export const gymAccessEventsTable = pgTable("gym_access_events", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  clientId: integer("client_id").references(() => clientsTable.id, { onDelete: "set null" }),
  personName: text("person_name").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: integer("created_by").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("gym_access_events_org_occurred_idx").on(table.organizationId, table.occurredAt),
  index("gym_access_events_org_client_occurred_idx").on(table.organizationId, table.clientId, table.occurredAt),
  index("gym_access_events_org_person_idx").on(table.organizationId, table.personName),
]);

export const insertGymAccessEventSchema = createInsertSchema(gymAccessEventsTable)
  .omit({ id: true, createdAt: true });

export type InsertGymAccessEvent = typeof gymAccessEventsTable.$inferInsert;
export type GymAccessEvent = typeof gymAccessEventsTable.$inferSelect;
