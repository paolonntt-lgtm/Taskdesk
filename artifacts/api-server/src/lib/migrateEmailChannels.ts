import { eq, like, and } from "drizzle-orm";
import { db, settingsTable, emailChannelsTable } from "@workspace/db";
import { logger } from "./logger";

/**
 * On first access, migrates legacy org_N_smtp_config and org_N_imap_config
 * settings entries into the email_channels table.
 * Safe to call multiple times — skips orgs that already have channels.
 */
export async function migrateEmailChannels(): Promise<void> {
  try {
    const smtpRows = await db
      .select()
      .from(settingsTable)
      .where(like(settingsTable.key, "org_%_smtp_config"));

    const imapRows = await db
      .select()
      .from(settingsTable)
      .where(like(settingsTable.key, "org_%_imap_config"));

    for (const row of smtpRows) {
      const m = row.key.match(/^org_(\d+)_smtp_config$/);
      if (!m) continue;
      const orgId = parseInt(m[1], 10);

      const existing = await db
        .select({ id: emailChannelsTable.id })
        .from(emailChannelsTable)
        .where(
          and(
            eq(emailChannelsTable.organizationId, orgId),
            eq(emailChannelsTable.type, "smtp")
          )
        )
        .limit(1);

      if (existing.length > 0) continue;

      try {
        const cfg = JSON.parse(row.value);
        if (!cfg.host || !cfg.user) continue;
        await db.insert(emailChannelsTable).values({
          organizationId: orgId,
          type: "smtp",
          label: cfg.from || cfg.user,
          host: cfg.host,
          port: cfg.port ?? 587,
          secure: cfg.secure ?? false,
          user: cfg.user,
          password: cfg.password ?? "",
          fromAddress: cfg.from ?? cfg.user,
          isPrimary: true,
          enabled: true,
        });
        logger.info({ orgId }, "Migrated legacy SMTP config to email_channels");
      } catch (err) {
        logger.warn({ err, key: row.key }, "Failed to migrate SMTP config");
      }
    }

    for (const row of imapRows) {
      const m = row.key.match(/^org_(\d+)_imap_config$/);
      if (!m) continue;
      const orgId = parseInt(m[1], 10);

      const existing = await db
        .select({ id: emailChannelsTable.id })
        .from(emailChannelsTable)
        .where(
          and(
            eq(emailChannelsTable.organizationId, orgId),
            eq(emailChannelsTable.type, "imap")
          )
        )
        .limit(1);

      if (existing.length > 0) continue;

      try {
        const cfg = JSON.parse(row.value);
        if (!cfg.host || !cfg.user) continue;
        await db.insert(emailChannelsTable).values({
          organizationId: orgId,
          type: "imap",
          label: cfg.label || cfg.user,
          host: cfg.host,
          port: cfg.port ?? 993,
          secure: cfg.secure ?? true,
          user: cfg.user,
          password: cfg.password ?? "",
          folder: cfg.folder ?? "INBOX",
          defaultCategory: cfg.defaultCategory ?? null,
          defaultGroup: cfg.defaultGroup ?? null,
          isPrimary: false,
          enabled: cfg.enabled ?? true,
        });
        logger.info({ orgId }, "Migrated legacy IMAP config to email_channels");
      } catch (err) {
        logger.warn({ err, key: row.key }, "Failed to migrate IMAP config");
      }
    }
  } catch (err) {
    logger.warn({ err }, "migrateEmailChannels failed — continuing without migration");
  }
}
