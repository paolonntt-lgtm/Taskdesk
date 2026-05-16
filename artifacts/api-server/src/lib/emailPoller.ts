import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { db, settingsTable } from "@workspace/db";
import { like, eq } from "drizzle-orm";
import { logger } from "./logger";
import { processInboundEmail } from "./ticketFromEmail";

export interface ImapConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  enabled: boolean;
  folder?: string;
  defaultCategory?: string;
  defaultGroup?: string;
}

export interface ImapStatus {
  lastPollAt: string | null;
  lastError: string | null;
  ticketsCreated: number;
  /** true after the first-run baseline pass completes (marks existing emails as read without creating tickets) */
  baselined: boolean;
}

const POLL_INTERVAL_MS = 3 * 60 * 1000;

function makeClient(config: ImapConfig): ImapFlow {
  return new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password },
    logger: false,
    tls: { rejectUnauthorized: false },
    connectionTimeout: 15_000,
  });
}

async function getAllImapConfigs(): Promise<Array<{ orgId: number; config: ImapConfig }>> {
  const rows = await db
    .select()
    .from(settingsTable)
    .where(like(settingsTable.key, "org_%_imap_config"));

  const result: Array<{ orgId: number; config: ImapConfig }> = [];
  for (const row of rows) {
    const match = row.key.match(/^org_(\d+)_imap_config$/);
    if (!match) continue;
    const orgId = parseInt(match[1], 10);
    try {
      const config: ImapConfig = JSON.parse(row.value);
      if (config.enabled && config.host && config.user && config.password) {
        result.push({ orgId, config });
      }
    } catch {
      logger.warn({ key: row.key }, "Invalid IMAP config JSON");
    }
  }
  return result;
}

export async function getImapStatus(orgId: number): Promise<ImapStatus | null> {
  const key = `org_${orgId}_imap_status`;
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
  if (!row) return null;
  try { return JSON.parse(row.value) as ImapStatus; } catch { return null; }
}

async function updateStatus(orgId: number, patch: Partial<ImapStatus>): Promise<void> {
  const key = `org_${orgId}_imap_status`;
  const current = (await getImapStatus(orgId)) ?? { lastPollAt: null, lastError: null, ticketsCreated: 0, baselined: false };
  const updated: ImapStatus = { ...current, ...patch };
  await db
    .insert(settingsTable)
    .values({ key, value: JSON.stringify(updated) })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value: JSON.stringify(updated) } });
}

/**
 * First-run baseline: marks all currently unseen emails as read WITHOUT creating tickets.
 * This ensures only emails arriving after the configuration is saved become tickets.
 * Called once after saving IMAP credentials for the first time.
 */
export async function baselineMailbox(orgId: number, config: ImapConfig): Promise<void> {
  const folder = config.folder || "INBOX";
  const client = makeClient(config);

  try {
    await client.connect();
    const lock = await client.getMailboxLock(folder);
    let marked = 0;

    try {
      const searchResult = await client.search({ seen: false }, { uid: true });
      const uids = Array.isArray(searchResult) ? searchResult : [];
      if (uids.length > 0) {
        await client.messageFlagsAdd(uids, ["\\Seen"], { uid: true });
        marked = uids.length;
      }
    } finally {
      lock.release();
    }

    await client.logout();
    await updateStatus(orgId, {
      baselined: true,
      lastError: null,
    });
    logger.info({ orgId, marked }, "IMAP baseline complete: existing emails marked as read");
  } catch (err: any) {
    logger.warn({ err, orgId }, "IMAP baseline failed — will retry on first poll");
    // Don't mark as baselined — will try again on first poll
    try { await client.logout(); } catch {}
  }
}

async function pollMailbox(orgId: number, config: ImapConfig): Promise<void> {
  const status = await getImapStatus(orgId);

  // If never baselined (first run), do baseline pass now instead of creating tickets
  if (!status?.baselined) {
    logger.info({ orgId }, "IMAP first run — running baseline pass");
    await baselineMailbox(orgId, config);
    return;
  }

  const folder = config.folder || "INBOX";
  const client = makeClient(config);

  try {
    await client.connect();
    const lock = await client.getMailboxLock(folder);
    let created = 0;

    try {
      const searchResult = await client.search({ seen: false }, { uid: true });
      const uids = Array.isArray(searchResult) ? searchResult : [];

      if (uids.length > 0) {
        for await (const msg of client.fetch(uids, { source: true, uid: true }, { uid: true })) {
          try {
            const parsed = await simpleParser(msg.source as Buffer);
            const fromAddr = parsed.from?.value[0]?.address ?? "";
            const fromName = parsed.from?.value[0]?.name || fromAddr;
            const subject = parsed.subject ?? "Richiesta di assistenza";
            const bodyText = parsed.text ?? "";
            const messageId = parsed.messageId ?? undefined;
            const inReplyTo = parsed.inReplyTo ?? undefined;
            const referencesRaw = parsed.references;
            const referencesStr = Array.isArray(referencesRaw)
              ? referencesRaw.join(" ")
              : typeof referencesRaw === "string"
              ? referencesRaw
              : undefined;

            if (!fromAddr) continue;

            await processInboundEmail({ fromEmail: fromAddr, fromName, subject, bodyText, orgId, messageId, inReplyTo, references: referencesStr });
            await client.messageFlagsAdd({ uid: msg.uid }, ["\\Seen"], { uid: true });
            created++;
          } catch (err) {
            logger.error({ err, orgId, uid: msg.uid }, "Error creating ticket from email");
          }
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();

    const prev = await getImapStatus(orgId);
    await updateStatus(orgId, {
      lastPollAt: new Date().toISOString(),
      lastError: null,
      ticketsCreated: (prev?.ticketsCreated ?? 0) + created,
    });

    if (created > 0) {
      logger.info({ orgId, created }, "IMAP poll: created tickets from email");
    }
  } catch (err: any) {
    logger.error({ err, orgId, host: config.host }, "IMAP poll failed");
    await updateStatus(orgId, {
      lastPollAt: new Date().toISOString(),
      lastError: err?.message ?? "Connessione fallita",
    });
    try { await client.logout(); } catch {}
  }
}

async function pollAll(): Promise<void> {
  try {
    const [imapConfigs, gmailOrgIds, microsoftOrgIds] = await Promise.all([
      getAllImapConfigs(),
      import("./gmailPoller").then((m) => m.getAllGmailOrgIds()),
      import("./microsoftPoller").then((m) => m.getAllMicrosoftOrgIds()),
    ]);

    const tasks: Promise<void>[] = [
      ...imapConfigs.map(({ orgId, config }) => pollMailbox(orgId, config)),
      ...gmailOrgIds.map((orgId) => import("./gmailPoller").then((m) => m.pollGmailOrg(orgId))),
      ...microsoftOrgIds.map((orgId) => import("./microsoftPoller").then((m) => m.pollMicrosoftOrg(orgId))),
    ];

    if (tasks.length === 0) return;
    logger.info({ imap: imapConfigs.length, gmail: gmailOrgIds.length, microsoft: microsoftOrgIds.length }, "Starting email poll cycle");
    await Promise.allSettled(tasks);
  } catch (err) {
    logger.error({ err }, "Email pollAll error");
  }
}

export function startEmailPoller(): void {
  setTimeout(() => {
    pollAll();
    setInterval(pollAll, POLL_INTERVAL_MS);
  }, 30_000);
  logger.info({ intervalMin: POLL_INTERVAL_MS / 60000 }, "Email poller scheduled");
}

export async function testImapConnection(config: ImapConfig): Promise<{ ok: boolean; error?: string }> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password },
    logger: false,
    tls: { rejectUnauthorized: false },
    connectionTimeout: 10_000,
  });
  try {
    await client.connect();
    await client.logout();
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "Connessione fallita" };
  }
}
