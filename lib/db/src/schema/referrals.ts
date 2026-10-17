import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizationsTable } from "./organizations";

export const referralCodesTable = pgTable("referral_codes", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("referral_codes_organization_uniq").on(table.organizationId),
  uniqueIndex("referral_codes_code_uniq").on(table.code),
]);

export const pendingReferralAttributionsTable = pgTable("pending_referral_attributions", {
  id: serial("id").primaryKey(),
  referredOrganizationId: integer("referred_organization_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  attempts: integer("attempts").notNull().default(0),
  retryAfter: timestamp("retry_after", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("pending_referral_attributions_org_uniq").on(table.referredOrganizationId),
]);

export const referralsTable = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referrerOrganizationId: integer("referrer_organization_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  referredOrganizationId: integer("referred_organization_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending_payment"),
  qualifyingInvoiceId: text("qualifying_invoice_id"),
  rewardCustomerId: text("reward_customer_id"),
  rewardAmount: integer("reward_amount"),
  rewardCurrency: text("reward_currency"),
  stripeBalanceTransactionId: text("stripe_balance_transaction_id"),
  stripeRewardReversalBalanceTransactionId: text("stripe_reward_reversal_balance_transaction_id"),
  rewardRevocationReason: text("reward_revocation_reason"),
  rewardRevokedAt: timestamp("reward_revoked_at", { withTimezone: true }),
  qualifiedAt: timestamp("qualified_at", { withTimezone: true }),
  rewardedAt: timestamp("rewarded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("referrals_referred_organization_uniq").on(table.referredOrganizationId),
  uniqueIndex("referrals_qualifying_invoice_uniq")
    .on(table.qualifyingInvoiceId)
    .where(sql`${table.qualifyingInvoiceId} IS NOT NULL`),
]);

export type ReferralCode = typeof referralCodesTable.$inferSelect;
export type Referral = typeof referralsTable.$inferSelect;
