import { pgTable, serial, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("user"),
  organizationId: integer("organization_id").references(() => organizationsTable.id),
  mainLocation: text("main_location"),
  group: text("group"),
  groups: text("groups"),
  permissionOverrides: text("permission_overrides").notNull().default("{}"),
  phone: text("phone"),
  avatarUrl: text("avatar_url"),
  isActive: boolean("is_active").notNull().default(true),
  isAvailable: boolean("is_available").notNull().default(true),
  hourlyCompensated: boolean("hourly_compensated").notNull().default(false),
  isSuperAdmin: boolean("is_superadmin").notNull().default(false),
  isSystem: boolean("is_system").notNull().default(false),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  expoPushToken: text("expo_push_token"),
  dashboardLayout: text("dashboard_layout"),
  tourDone: boolean("tour_done").notNull().default(false),
  registeredViaInvite: boolean("registered_via_invite").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
