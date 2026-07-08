import { pool } from "@workspace/db";
import { logger } from "./logger";

export async function runAppMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    // Add ticket_number column if it doesn't exist
    await client.query(`
      ALTER TABLE tickets ADD COLUMN IF NOT EXISTS ticket_number INTEGER;
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

    logger.info("App migrations completed");
  } catch (err) {
    logger.error({ err }, "App migration failed");
    throw err;
  } finally {
    client.release();
  }
}
