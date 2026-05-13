import { db, settingsTable } from "@workspace/db";
import { eq, like } from "drizzle-orm";
import { logger } from "./logger";
import { createTicketFromEmail } from "./ticketFromEmail";

export interface GmailTokens {
  access_token: string;
  refresh_token: string;
  email: string;
  expires_at_ms: number;
}

export interface GmailStatus {
  lastPollAt: string | null;
  lastError: string | null;
  ticketsCreated: number;
  baselined: boolean;
  /** Unix epoch seconds — only process messages received AFTER this timestamp */
  baselineEpochSec?: number;
}

const tokensKey = (orgId: number) => `org_${orgId}_gmail_tokens`;
const statusKey  = (orgId: number) => `org_${orgId}_gmail_status`;

export async function getGmailTokens(orgId: number): Promise<GmailTokens | null> {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, tokensKey(orgId)));
  if (!row) return null;
  try { return JSON.parse(row.value) as GmailTokens; } catch { return null; }
}

export async function saveGmailTokens(orgId: number, tokens: GmailTokens): Promise<void> {
  const key = tokensKey(orgId);
  await db.insert(settingsTable).values({ key, value: JSON.stringify(tokens) })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value: JSON.stringify(tokens) } });
}

export async function deleteGmailTokens(orgId: number): Promise<void> {
  await db.delete(settingsTable).where(eq(settingsTable.key, tokensKey(orgId)));
  await db.delete(settingsTable).where(eq(settingsTable.key, statusKey(orgId)));
}

export async function getGmailStatus(orgId: number): Promise<GmailStatus | null> {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, statusKey(orgId)));
  if (!row) return null;
  try { return JSON.parse(row.value) as GmailStatus; } catch { return null; }
}

async function updateGmailStatus(orgId: number, patch: Partial<GmailStatus>): Promise<void> {
  const key = statusKey(orgId);
  const current = (await getGmailStatus(orgId)) ?? { lastPollAt: null, lastError: null, ticketsCreated: 0, baselined: false };
  const updated = { ...current, ...patch };
  await db.insert(settingsTable).values({ key, value: JSON.stringify(updated) })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value: JSON.stringify(updated) } });
}

async function refreshGmailToken(orgId: number, tokens: GmailTokens): Promise<GmailTokens | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId, client_secret: clientSecret,
        refresh_token: tokens.refresh_token, grant_type: "refresh_token",
      }),
    });
    const data = await res.json() as { access_token?: string; expires_in?: number; error?: string };
    if (!res.ok || !data.access_token) { logger.error({ data, orgId }, "Gmail token refresh failed"); return null; }
    const updated: GmailTokens = {
      ...tokens,
      access_token: data.access_token,
      expires_at_ms: Date.now() + (data.expires_in ?? 3600) * 1000,
    };
    await saveGmailTokens(orgId, updated);
    return updated;
  } catch (err) { logger.error({ err, orgId }, "Gmail token refresh error"); return null; }
}

async function validTokens(orgId: number, tokens: GmailTokens): Promise<GmailTokens | null> {
  return Date.now() >= tokens.expires_at_ms - 60_000 ? refreshGmailToken(orgId, tokens) : tokens;
}

function extractBody(payload: any): string {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64url").toString("utf-8").trim();
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractBody(part);
      if (text) return text;
    }
  }
  return "";
}

/**
 * Baseline: just records the current epoch second as a cutoff.
 * The poll will only process messages received AFTER this timestamp.
 * No batchModify needed — avoids quota / reliability issues.
 */
export async function baselineGmailOrg(orgId: number): Promise<void> {
  const baselineEpochSec = Math.floor(Date.now() / 1000);
  await updateGmailStatus(orgId, { baselined: true, baselineEpochSec, lastError: null });
  logger.info({ orgId, baselineEpochSec }, "Gmail baseline complete (timestamp cutoff set)");
}

export async function pollGmailOrg(orgId: number): Promise<void> {
  const tokens = await getGmailTokens(orgId);
  if (!tokens) return;

  const status = await getGmailStatus(orgId);

  // If not baselined OR baselined with old approach (no timestamp), re-baseline
  if (!status?.baselined || !status.baselineEpochSec) {
    logger.info({ orgId }, "Gmail: running baseline pass");
    await baselineGmailOrg(orgId);
    return;
  }

  const valid = await validTokens(orgId, tokens);
  if (!valid) {
    await updateGmailStatus(orgId, { lastError: "Token scaduto — riconnetti Gmail", lastPollAt: new Date().toISOString() });
    return;
  }

  try {
    let created = 0;
    let pageToken: string | undefined;

    // Use `after:` to only fetch messages received after baseline timestamp
    const afterFilter = `is:unread after:${status.baselineEpochSec}`;

    do {
      const params = new URLSearchParams({ labelIds: "INBOX", q: afterFilter, maxResults: "20" });
      if (pageToken) params.set("pageToken", pageToken);
      const listRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`, {
        headers: { Authorization: `Bearer ${valid.access_token}` },
      });
      const listData = await listRes.json() as { messages?: Array<{ id: string }>; nextPageToken?: string };
      if (!listData.messages?.length) break;

      for (const { id } of listData.messages) {
        try {
          const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`, {
            headers: { Authorization: `Bearer ${valid.access_token}` },
          });
          const msg = await msgRes.json() as { payload?: any };
          const headers: Array<{ name: string; value: string }> = msg.payload?.headers ?? [];
          const fromHeader = headers.find((h) => h.name === "From")?.value ?? "";
          const subject = headers.find((h) => h.name === "Subject")?.value ?? "Richiesta di assistenza";
          const emailMatch = fromHeader.match(/<([^>]+)>/);
          const fromEmail = emailMatch ? emailMatch[1] : fromHeader.trim();
          const fromName = fromHeader.replace(/<[^>]+>/g, "").replace(/"/g, "").trim() || fromEmail;
          const bodyText = extractBody(msg.payload);
          if (!fromEmail) continue;

          await createTicketFromEmail({ fromEmail, fromName, subject, bodyText, orgId });

          // Mark as read so it won't be picked up again on the next poll
          await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}/modify`, {
            method: "POST",
            headers: { Authorization: `Bearer ${valid.access_token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ removeLabelIds: ["UNREAD"] }),
          });
          created++;
        } catch (err) { logger.error({ err, orgId, msgId: id }, "Error processing Gmail message"); }
      }
      pageToken = listData.nextPageToken;
    } while (pageToken);

    const prev = await getGmailStatus(orgId);
    await updateGmailStatus(orgId, {
      lastPollAt: new Date().toISOString(),
      lastError: null,
      ticketsCreated: (prev?.ticketsCreated ?? 0) + created,
    });
    if (created > 0) logger.info({ orgId, created }, "Gmail poll: created tickets");
  } catch (err: any) {
    logger.error({ err, orgId }, "Gmail poll failed");
    await updateGmailStatus(orgId, { lastPollAt: new Date().toISOString(), lastError: err?.message ?? "Errore" });
  }
}

export async function getAllGmailOrgIds(): Promise<number[]> {
  const rows = await db.select().from(settingsTable).where(like(settingsTable.key, "org_%_gmail_tokens"));
  return rows.map((r) => { const m = r.key.match(/^org_(\d+)_gmail_tokens$/); return m ? parseInt(m[1], 10) : null; }).filter((id): id is number => id !== null);
}
