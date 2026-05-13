import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { db, settingsTable } from "@workspace/db";
import { like, eq } from "drizzle-orm";
import { logger } from "./logger";
import { createTicketFromEmail } from "./ticketFromEmail";

export interface ImapConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  enabled: boolean;
  folder?: string;
}

export interface ImapStatus {
  lastPollAt: string | null;
  lastError: string | null;
  ticketsCreated: number;
}

const POLL_INTERVAL_MS = 3 * 60 * 1000;

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
  const current = (await getImapStatus(orgId)) ?? { lastPollAt: null, lastError: null, ticketsCreated: 0 };
  const updated: ImapStatus = { ...current, ...patch };
  await db
    .insert(settingsTable)
    .values({ key, value: JSON.stringify(updated) })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value: JSON.stringify(updated) } });
}

async function pollMailbox(orgId: number, config: ImapConfig): Promise<void> {
  const folder = config.folder || "INBOX";
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password },
    logger: false,
    tls: { rejectUnauthorized: false },
  });

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

            if (!fromAddr) continue;

            await createTicketFromEmail({ fromEmail: fromAddr, fromName, subject, bodyText, orgId });
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
    const configs = await getAllImapConfigs();
    if (configs.length === 0) return;
    logger.info({ count: configs.length }, "Starting IMAP poll cycle");
    await Promise.allSettled(configs.map(({ orgId, config }) => pollMailbox(orgId, config)));
  } catch (err) {
    logger.error({ err }, "IMAP pollAll error");
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
