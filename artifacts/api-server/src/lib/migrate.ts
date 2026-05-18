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

    logger.info("App migrations completed");
  } catch (err) {
    logger.error({ err }, "App migration failed");
    throw err;
  } finally {
    client.release();
  }
}
