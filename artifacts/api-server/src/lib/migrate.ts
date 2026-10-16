import { pool } from "@workspace/db";
import { logger } from "./logger";

export async function runAppMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    // Add ticket_number column if it doesn't exist
    await client.query(`
      ALTER TABLE tickets ADD COLUMN IF NOT EXISTS ticket_number INTEGER;
    `);

    // Store the total time spent on a ticket as whole minutes.
    await client.query(`
      ALTER TABLE tickets ADD COLUMN IF NOT EXISTS worked_minutes INTEGER;
    `);

    // Track whether recorded extra work has already been billed.
    await client.query(`
      ALTER TABLE tickets
        ADD COLUMN IF NOT EXISTS worked_billing_status TEXT NOT NULL DEFAULT 'unbilled';
    `);

    // Keep deleted tickets recoverable in the trash for the retention period.
    await client.query(`
      ALTER TABLE tickets ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
      CREATE INDEX IF NOT EXISTS tickets_deleted_at_idx ON tickets (organization_id, deleted_at);
    `);

    // Backfill ticket_number for rows that don't have it yet,
    // assigning per-organization sequential numbers starting from 1
    await client.query(`
      WITH ranked AS (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY COALESCE(organization_id, 0)
                 ORDER BY created_at, id
               ) AS rn
        FROM tickets
        WHERE ticket_number IS NULL
      )
      UPDATE tickets t
      SET ticket_number = r.rn
      FROM ranked r
      WHERE t.id = r.id;
    `);

    // Add updated_at column to ticket_comments if it doesn't exist
    await client.query(`
      ALTER TABLE ticket_comments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
    `);

    // Backfill onboarding_done: organisations that pre-date the onboarding feature
    // (created before 2026-05-22) should be treated as already onboarded so their
    // admins are never shown the onboarding screen on login.
    // New orgs registered after this date are explicitly created with onboarding_done=false
    // by the register and Google OAuth routes and must complete the onboarding flow.
    await client.query(`
      UPDATE organizations
      SET onboarding_done = true
      WHERE onboarding_done = false
        AND created_at < '2026-05-22T00:00:00Z';
    `);

    // Remove legacy IMAP email_channels rows and orphaned settings keys
    await client.query(`
      DELETE FROM email_channels WHERE type = 'imap';
    `);
    await client.query(`
      DELETE FROM settings WHERE key LIKE 'org_%_imap_config'
         OR key LIKE 'email_channel_%_status'
         OR key LIKE 'org_%_gmail_%'
         OR key LIKE 'org_%_microsoft_%';
    `);

    // Add clients_enabled column to organizations if it doesn't exist
    await client.query(`
      ALTER TABLE organizations ADD COLUMN IF NOT EXISTS clients_enabled BOOLEAN NOT NULL DEFAULT true;
    `);

    // Create sticky_notes table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sticky_notes (
        id SERIAL PRIMARY KEY,
        organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
        created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        text TEXT NOT NULL DEFAULT '',
        color VARCHAR(32) NOT NULL DEFAULT 'yellow',
        visibility VARCHAR(32) NOT NULL DEFAULT 'private',
        target_group_name VARCHAR(128),
        target_user_ids TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Create sticky_note_user_states table (id PK + unique constraint matches Drizzle schema)
    await client.query(`
      CREATE TABLE IF NOT EXISTS sticky_note_user_states (
        id SERIAL PRIMARY KEY,
        note_id INTEGER NOT NULL REFERENCES sticky_notes(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        position_x INTEGER NOT NULL DEFAULT 100,
        position_y INTEGER NOT NULL DEFAULT 100,
        closed BOOLEAN NOT NULL DEFAULT false,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT sticky_note_user_uniq UNIQUE (note_id, user_id)
      );
    `);

    // Add width/height columns to sticky_note_user_states for per-user resize persistence
    await client.query(`
      ALTER TABLE sticky_note_user_states ADD COLUMN IF NOT EXISTS width INTEGER;
      ALTER TABLE sticky_note_user_states ADD COLUMN IF NOT EXISTS height INTEGER;
    `);

    // Add UTM tracking columns to organizations
    await client.query(`
      ALTER TABLE organizations ADD COLUMN IF NOT EXISTS utm_source TEXT;
      ALTER TABLE organizations ADD COLUMN IF NOT EXISTS utm_medium TEXT;
      ALTER TABLE organizations ADD COLUMN IF NOT EXISTS utm_campaign TEXT;
    `);

    // Add layout column to clients for team-shared dashboard block order/visibility
    await client.query(`
      ALTER TABLE clients ADD COLUMN IF NOT EXISTS layout JSONB;
    `);

    // Add shared layout column to organizations for org-wide client block layout
    await client.query(`
      ALTER TABLE organizations ADD COLUMN IF NOT EXISTS client_shared_layout JSONB;
    `);

    // Add checkedById and checkedAt to ticket_checklist_items for "checked by" tooltip
    await client.query(`
      ALTER TABLE ticket_checklist_items
        ADD COLUMN IF NOT EXISTS checked_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS checked_at TIMESTAMPTZ;
    `);

    // Create bug_reports table for superadmin bug report tracking
    await client.query(`
      CREATE TABLE IF NOT EXISTS bug_reports (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
        user_name TEXT NOT NULL,
        user_email TEXT NOT NULL,
        description TEXT NOT NULL,
        current_page TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending',
        reply_text TEXT,
        replied_at TIMESTAMPTZ,
        processed_at TIMESTAMPTZ,
        is_read BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS bug_reports_status_idx ON bug_reports (status);
      CREATE INDEX IF NOT EXISTS bug_reports_created_at_idx ON bug_reports (created_at);
      CREATE INDEX IF NOT EXISTS bug_reports_is_read_idx ON bug_reports (is_read);
    `);

    // Add reminder columns to appointments table
    await client.query(`
      ALTER TABLE appointments
        ADD COLUMN IF NOT EXISTS reminder_minutes INTEGER NOT NULL DEFAULT 60,
        ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS is_all_day BOOLEAN NOT NULL DEFAULT false;
    `);

    // Add notes2 column to clients for second fixed-notes block
    await client.query(`
      ALTER TABLE clients ADD COLUMN IF NOT EXISTS notes2 TEXT;
    `);

    // Add tour_done and registered_via_invite columns to users for invite onboarding flow
    await client.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS tour_done BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS registered_via_invite BOOLEAN NOT NULL DEFAULT false;
    `);

    // Backfill org shared layout: ensure fixed-notes-2 block is present for all existing orgs
    await client.query(`
      UPDATE organizations
      SET client_shared_layout = (
        CASE
          WHEN client_shared_layout IS NULL THEN
            '[{"id":"company-info","instanceId":"company-info","visible":true},{"id":"fixed-notes","instanceId":"fixed-notes","visible":true},{"id":"fixed-notes-2","instanceId":"fixed-notes-2","visible":true},{"id":"client-notes","instanceId":"client-notes","visible":true},{"id":"linked-tickets","instanceId":"linked-tickets","visible":true}]'::jsonb
          WHEN NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements(client_shared_layout) AS b
            WHERE b->>'instanceId' = 'fixed-notes-2'
          ) THEN
            client_shared_layout || '[{"id":"fixed-notes-2","instanceId":"fixed-notes-2","visible":true}]'::jsonb
          ELSE
            client_shared_layout
        END
      )
      WHERE client_shared_layout IS NULL
         OR NOT EXISTS (
           SELECT 1 FROM jsonb_array_elements(client_shared_layout) AS b
           WHERE b->>'instanceId' = 'fixed-notes-2'
         );
    `);

    // Add trial reminder flag columns to organizations
    await client.query(`
      ALTER TABLE organizations ADD COLUMN IF NOT EXISTS trial_reminder_sent_at TIMESTAMPTZ;
      ALTER TABLE organizations ADD COLUMN IF NOT EXISTS trial_expired_reminder_sent_at TIMESTAMPTZ;
    `);

    // Backfill: orgs whose trial is already expired (and no subscription) should have
    // the expired-reminder flag set immediately so the job never sends a retroactive email.
    await client.query(`
      UPDATE organizations o
      SET trial_expired_reminder_sent_at = NOW()
      WHERE o.trial_expired_reminder_sent_at IS NULL
        AND EXISTS (
          SELECT 1 FROM users u
          WHERE u.organization_id = o.id
            AND u.role = 'admin'
            AND u.is_active = true
            AND u.trial_ends_at IS NOT NULL
            AND u.trial_ends_at < NOW()
            AND u.stripe_subscription_id IS NULL
        );
    `);

    // Add custom entity term columns to organizations
    await client.query(`
      ALTER TABLE organizations ADD COLUMN IF NOT EXISTS entity_singular TEXT;
      ALTER TABLE organizations ADD COLUMN IF NOT EXISTS entity_plural TEXT;
    `);

    // Closure emails are opt-in. Apply the default to existing organizations once,
    // without overwriting a later admin choice on subsequent server starts.
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_migrations (
        key TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE organizations
        ADD COLUMN IF NOT EXISTS send_closure_email BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE organizations
        ALTER COLUMN send_closure_email SET DEFAULT false;
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM app_migrations
          WHERE key = 'closure_email_opt_in_default'
        ) THEN
          UPDATE organizations SET send_closure_email = false;
          INSERT INTO app_migrations (key) VALUES ('closure_email_opt_in_default');
        END IF;
      END $$;
    `);

    // Worked time is enabled by default for all organizations. When disabled,
    // the historical values remain stored but are hidden from the ticket UI and reports.
    await client.query(`
      ALTER TABLE organizations
        ADD COLUMN IF NOT EXISTS worked_time_enabled BOOLEAN NOT NULL DEFAULT true;
    `);

    // Optional timer module. Existing manual worked-time records remain untouched.
    await client.query(`
      ALTER TABLE organizations
        ADD COLUMN IF NOT EXISTS time_tracking_module_enabled BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS hourly_compensated BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE tickets
        ADD COLUMN IF NOT EXISTS time_tracking_enabled BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS time_tracking_billable BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS time_tracking_compensation_override BOOLEAN;
      CREATE TABLE IF NOT EXISTS ticket_time_sessions (
        id SERIAL PRIMARY KEY,
        organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ended_at TIMESTAMPTZ,
        client_billable BOOLEAN NOT NULL DEFAULT false,
        collaborator_recognizable BOOLEAN NOT NULL DEFAULT false
      );
      CREATE INDEX IF NOT EXISTS ticket_time_sessions_org_started_idx
        ON ticket_time_sessions (organization_id, started_at);
      CREATE INDEX IF NOT EXISTS ticket_time_sessions_ticket_idx
        ON ticket_time_sessions (ticket_id, started_at);
      CREATE INDEX IF NOT EXISTS ticket_time_sessions_user_idx
        ON ticket_time_sessions (user_id, started_at);
      CREATE UNIQUE INDEX IF NOT EXISTS ticket_time_sessions_one_active_per_user
        ON ticket_time_sessions (user_id) WHERE ended_at IS NULL;
    `);
    await client.query(`
      ALTER TABLE ticket_time_sessions
        ADD COLUMN IF NOT EXISTS collaborator_invoice_received BOOLEAN NOT NULL DEFAULT false;
    `);
    await client.query(`
      UPDATE ticket_statuses
      SET label = 'In attesa'
      WHERE key = 'waiting_client'
        AND label = 'In attesa cliente';
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS ticket_time_session_edits (
        id SERIAL PRIMARY KEY,
        organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
        session_id INTEGER NOT NULL REFERENCES ticket_time_sessions(id) ON DELETE CASCADE,
        collaborator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        edited_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        previous_duration_minutes INTEGER NOT NULL,
        updated_duration_minutes INTEGER NOT NULL,
        previous_client_billable BOOLEAN NOT NULL,
        updated_client_billable BOOLEAN NOT NULL,
        previous_collaborator_recognizable BOOLEAN NOT NULL,
        updated_collaborator_recognizable BOOLEAN NOT NULL,
        edited_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS ticket_time_session_edits_ticket_idx
        ON ticket_time_session_edits (ticket_id, edited_at);
      CREATE INDEX IF NOT EXISTS ticket_time_session_edits_collaborator_idx
        ON ticket_time_session_edits (collaborator_id, edited_at);
    `);

    // Daily reports — operator EOD report saved in DB; colleagues see badge + auto-briefing
    await client.query(`
      CREATE TABLE IF NOT EXISTS daily_reports (
        id SERIAL PRIMARY KEY,
        organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        author_user_id INTEGER NOT NULL REFERENCES users(id),
        date DATE NOT NULL,
        content TEXT NOT NULL,
        tickets_snapshot JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS daily_reports_org_date_idx ON daily_reports (organization_id, date);
    `);

    // Add location column to daily_reports (for sede-aware reports)
    await client.query(`
      ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS location TEXT;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS daily_report_reads (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        daily_report_id INTEGER NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
        read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT daily_report_reads_user_report_uniq UNIQUE (user_id, daily_report_id)
      );
    `);

    await client.query(`
      ALTER TABLE notifications
        ADD COLUMN IF NOT EXISTS daily_report_id INTEGER
        REFERENCES daily_reports(id) ON DELETE CASCADE;
    `);

    // Attach older report notifications to their report when their author and
    // publication time identify a single close match. Leave ambiguous/unmatched
    // rows untouched rather than linking them to the wrong report.
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM app_migrations
          WHERE key = 'daily_report_notification_links'
        ) THEN
          WITH ranked_matches AS (
            SELECT
              n.id AS notification_id,
              dr.id AS report_id,
              ROW_NUMBER() OVER (
                PARTITION BY n.id
                ORDER BY ABS(EXTRACT(EPOCH FROM (n.created_at - dr.created_at))), dr.id DESC
              ) AS match_rank,
              COUNT(*) OVER (PARTITION BY n.id) AS match_count
            FROM notifications n
            JOIN users recipient ON recipient.id = n.user_id
            JOIN daily_reports dr ON dr.organization_id = recipient.organization_id
            JOIN users author ON author.id = dr.author_user_id
            WHERE n.type = 'daily_report_submitted'
              AND n.daily_report_id IS NULL
              AND n.notification_text = author.name || ' ha pubblicato il report di oggi'
              AND n.created_at >= dr.created_at - INTERVAL '10 seconds'
              AND n.created_at < dr.created_at + INTERVAL '5 minutes'
          )
          UPDATE notifications n
          SET daily_report_id = ranked_matches.report_id
          FROM ranked_matches
          WHERE n.id = ranked_matches.notification_id
            AND ranked_matches.match_rank = 1
            AND ranked_matches.match_count = 1;

          INSERT INTO app_migrations (key) VALUES ('daily_report_notification_links');
        END IF;
      END $$;
    `);

    // Ticket visibility: existing tickets remain visible to the organization.
    await client.query(`
      ALTER TABLE tickets
        ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'organization';
      ALTER TABLE inbound_email_channels
        ADD COLUMN IF NOT EXISTS default_visibility TEXT NOT NULL DEFAULT 'organization';
    `);

    // Referral attribution and one-time Stripe reward ledger.
    await client.query(`
      CREATE TABLE IF NOT EXISTS referral_codes (
        id SERIAL PRIMARY KEY,
        organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        code TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS referral_codes_organization_uniq
        ON referral_codes (organization_id);
      CREATE UNIQUE INDEX IF NOT EXISTS referral_codes_code_uniq
        ON referral_codes (code);

      CREATE TABLE IF NOT EXISTS referrals (
        id SERIAL PRIMARY KEY,
        referrer_organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        referred_organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'pending_payment',
        qualifying_invoice_id TEXT,
        reward_customer_id TEXT,
        reward_amount INTEGER,
        reward_currency TEXT,
        stripe_balance_transaction_id TEXT,
        qualified_at TIMESTAMPTZ,
        rewarded_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS referrals_referred_organization_uniq
        ON referrals (referred_organization_id);
      CREATE UNIQUE INDEX IF NOT EXISTS referrals_qualifying_invoice_uniq
        ON referrals (qualifying_invoice_id)
        WHERE qualifying_invoice_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS referrals_referrer_status_idx
        ON referrals (referrer_organization_id, status);
    `);

    logger.info("App migrations completed");
  } catch (err) {
    logger.error({ err }, "App migration failed");
    throw err;
  } finally {
    client.release();
  }
}
