import { pgTable, serial, integer, text, boolean, timestamp, index, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { ticketsTable } from "./tickets";
import { dailyReportsTable } from "./daily_reports";

export const NOTIFICATION_TYPES = [
  "ticket_created",
  "ticket_status_changed",
  "ticket_commented",
  "ticket_assigned",
  "ticket_priority_changed",
  "ticket_due",
  "daily_report_submitted",
  "system",
] as const;
export type NotificationType = typeof NOTIFICATION_TYPES[number];

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  ticketId: integer("ticket_id").references(() => ticketsTable.id, { onDelete: "cascade" }),
  dailyReportId: integer("daily_report_id").references(() => dailyReportsTable.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("system"),
  notificationText: text("notification_text").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("notifications_user_id_idx").on(t.userId),
  index("notifications_user_id_is_read_idx").on(t.userId, t.isRead),
  index("notifications_user_id_type_idx").on(t.userId, t.type),
]);

export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({ id: true, createdAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notificationsTable.$inferSelect;

export const notificationPreferencesTable = pgTable("notification_preferences", {
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  inApp: boolean("in_app").notNull().default(true),
  browser: boolean("browser").notNull().default(true),
  sound: boolean("sound").notNull().default(true),
  email: boolean("email").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.type] }),
]);

export type NotificationPreference = typeof notificationPreferencesTable.$inferSelect;
