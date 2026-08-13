import { pgTable, serial, integer, text, date, jsonb, timestamp, index, unique } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";
import { usersTable } from "./users";

export const dailyReportsTable = pgTable("daily_reports", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  authorUserId: integer("author_user_id").notNull().references(() => usersTable.id),
  date: date("date").notNull(),
  content: text("content").notNull(),
  ticketsSnapshot: jsonb("tickets_snapshot"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("daily_reports_org_date_idx").on(t.organizationId, t.date),
  unique("daily_reports_author_date_uniq").on(t.organizationId, t.authorUserId, t.date),
]);

export const dailyReportReadsTable = pgTable("daily_report_reads", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  dailyReportId: integer("daily_report_id").notNull().references(() => dailyReportsTable.id, { onDelete: "cascade" }),
  readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("daily_report_reads_user_report_uniq").on(t.userId, t.dailyReportId),
]);

export type DailyReport = typeof dailyReportsTable.$inferSelect;
export type DailyReportRead = typeof dailyReportReadsTable.$inferSelect;
