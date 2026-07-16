import { pgTable, serial, integer, text, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { organizationsTable } from "./organizations";

export const BUG_REPORT_STATUSES = ["pending", "replied", "processed"] as const;
export type BugReportStatus = typeof BUG_REPORT_STATUSES[number];

export const bugReportsTable = pgTable("bug_reports", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  organizationId: integer("organization_id").references(() => organizationsTable.id, { onDelete: "set null" }),
  userName: text("user_name").notNull(),
  userEmail: text("user_email").notNull(),
  description: text("description").notNull(),
  currentPage: text("current_page").notNull().default(""),
  status: text("status").notNull().default("pending"),
  replyText: text("reply_text"),
  repliedAt: timestamp("replied_at", { withTimezone: true }),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("bug_reports_status_idx").on(t.status),
  index("bug_reports_created_at_idx").on(t.createdAt),
  index("bug_reports_is_read_idx").on(t.isRead),
]);

export type BugReport = typeof bugReportsTable.$inferSelect;
