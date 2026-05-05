import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const organizationsTable = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  ragioneSociale: text("ragione_sociale"),
  piva: text("piva"),
  codiceFiscale: text("codice_fiscale"),
  indirizzo: text("indirizzo"),
  cap: text("cap"),
  citta: text("citta"),
  provincia: text("provincia"),
  paese: text("paese").default("IT"),
  sdiCode: text("sdi_code"),
  pec: text("pec"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Organization = typeof organizationsTable.$inferSelect;
