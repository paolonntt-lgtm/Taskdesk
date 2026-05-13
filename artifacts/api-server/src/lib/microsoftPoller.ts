import { db, settingsTable } from "@workspace/db";
import { eq, like } from "drizzle-orm";
import { logger } from "./logger";
import { createTicketFromEmail } from "./ticketFromEmail";

export interface MicrosoftTokens {
  access_token: string;
  refresh_token: string;
  email: string;
  expires_at_ms: number;
}

export interface MicrosoftStatus {
  lastPollAt: string | null;
  lastError: string | null;
  ticketsCreated: number;
  baselined: boolean;
}

const tokensKey = (orgId: number) => `org_${orgId}_microsoft_tokens`;
const statusKey = (orgId: number) => `org_${orgId}_microsoft_status`;
const GRAPH = "https://graph.microsoft.com/v1.0";

export async function getMicrosoftTokens(orgId: number): Promise<MicrosoftTokens | null> {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, tokensKey(orgId)));
  if (!row) return null;
  try { return JSON.parse(row.value) as MicrosoftTokens; } catch { return null; }
}

export async function saveMicrosoftTokens(orgId: number, tokens: MicrosoftTokens): Promise<void> {
  const key = tokensKey(orgId);
  await db.insert(settingsTable).values({ key, value: JSON.stringify(tokens) })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value: JSON.stringify(tokens) } });
}

export async function deleteMicrosoftTokens(orgId: number): Promise<void> {
  await db.delete(settingsTable).where(eq(settingsTable.key, tokensKey(orgId)));
  await db.delete(settingsTable).where(eq(settingsTable.key, statusKey(orgId)));
}

export async function getMicrosoftStatus(orgId: number): Promise<MicrosoftStatus | null> {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, statusKey(orgId)));
  if (!row) return null;
  try { return JSON.parse(row.value) as MicrosoftStatus; } catch { return null; }
}

async function updateMicrosoftStatus(orgId: number, patch: Partial<MicrosoftStatus>): Promise<void> {
  const key = statusKey(orgId);
  const current = (await getMicrosoftStatus(orgId)) ?? { lastPollAt: null, lastError: null, ticketsCreated: 0, baselined: false };
  const updated = { ...current, ...patch };
  await db.insert(settingsTable).values({ key, value: JSON.stringify(updated) })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value: JSON.stringify(updated) } });
}

async function refreshMicrosoftToken(orgId: number, tokens: MicrosoftTokens): Promise<MicrosoftTokens | null> {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  try {
    const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId, client_secret: clientSecret,
        refresh_token: tokens.refresh_token, grant_type: "refresh_token",
        scope: "offline_access Mail.Read Mail.ReadWrite",
      }),
    });
    const data = await res.json() as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string };
    if (!res.ok || !data.access_token) { logger.error({ data, orgId }, "Microsoft token refresh failed"); return null; }
    const updated: MicrosoftTokens = {
      ...tokens,
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? tokens.refresh_token,
      expires_at_ms: Date.now() + (data.expires_in ?? 3600) * 1000,
    };
    await saveMicrosoftTokens(orgId, updated);
    return updated;
  } catch (err) { logger.error({ err, orgId }, "Microsoft token refresh error"); return null; }
}

async function validTokens(orgId: number, tokens: MicrosoftTokens): Promise<MicrosoftTokens | null> {
  return Date.now() >= tokens.expires_at_ms - 60_000 ? refreshMicrosoftToken(orgId, tokens) : tokens;
}

export async function baselineMicrosoftOrg(orgId: number): Promise<void> {
  const tokens = await getMicrosoftTokens(orgId);
  if (!tokens) return;
  const valid = await validTokens(orgId, tokens);
  if (!valid) { await updateMicrosoftStatus(orgId, { lastError: "Token refresh fallito durante baseline" }); return; }

  try {
    // Mark all unread inbox messages as read (up to 1000)
    let nextLink: string | null = `${GRAPH}/me/mailFolders/inbox/messages?$filter=isRead eq false&$select=id&$top=50`;
    const allIds: string[] = [];

    while (nextLink && allIds.length < 1000) {
      const res = await fetch(nextLink, { headers: { Authorization: `Bearer ${valid.access_token}` } });
      const data = await res.json() as { value?: Array<{ id: string }>; "@odata.nextLink"?: string };
      if (data.value) allIds.push(...data.value.map((m) => m.id));
      nextLink = data["@odata.nextLink"] ?? null;
    }

    // Patch each to isRead=true (Graph has no batch modify for this, use Promise.allSettled in batches)
    for (let i = 0; i < allIds.length; i += 20) {
      await Promise.allSettled(
        allIds.slice(i, i + 20).map((id) =>
          fetch(`${GRAPH}/me/messages/${id}`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${valid.access_token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ isRead: true }),
          })
        )
      );
    }

    await updateMicrosoftStatus(orgId, { baselined: true, lastError: null });
    logger.info({ orgId, marked: allIds.length }, "Microsoft baseline complete");
  } catch (err: any) {
    logger.warn({ err, orgId }, "Microsoft baseline failed");
  }
}

export async function pollMicrosoftOrg(orgId: number): Promise<void> {
  const tokens = await getMicrosoftTokens(orgId);
  if (!tokens) return;

  const status = await getMicrosoftStatus(orgId);
  if (!status?.baselined) { await baselineMicrosoftOrg(orgId); return; }

  const valid = await validTokens(orgId, tokens);
  if (!valid) {
    await updateMicrosoftStatus(orgId, { lastError: "Token scaduto — riconnetti Microsoft", lastPollAt: new Date().toISOString() });
    return;
  }

  try {
    let created = 0;
    let nextLink: string | null =
      `${GRAPH}/me/mailFolders/inbox/messages?$filter=isRead eq false&$select=id,subject,from,body&$top=20`;

    while (nextLink) {
      const res = await fetch(nextLink, { headers: { Authorization: `Bearer ${valid.access_token}` } });
      const data = await res.json() as {
        value?: Array<{ id: string; subject?: string; from?: { emailAddress?: { name?: string; address?: string } }; body?: { content?: string; contentType?: string } }>;
        "@odata.nextLink"?: string;
      };

      for (const msg of data.value ?? []) {
        try {
          const fromEmail = msg.from?.emailAddress?.address ?? "";
          const fromName = msg.from?.emailAddress?.name || fromEmail;
          const subject = msg.subject ?? "Richiesta di assistenza";
          // Strip HTML tags for plain text body
          const rawBody = msg.body?.content ?? "";
          const bodyText = msg.body?.contentType === "html"
            ? rawBody.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
            : rawBody.trim();

          if (!fromEmail) continue;
          await createTicketFromEmail({ fromEmail, fromName, subject, bodyText, orgId });

          // Mark as read
          await fetch(`${GRAPH}/me/messages/${msg.id}`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${valid.access_token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ isRead: true }),
          });
          created++;
        } catch (err) { logger.error({ err, orgId, msgId: msg.id }, "Error processing Microsoft message"); }
      }
      nextLink = data["@odata.nextLink"] ?? null;
    }

    const prev = await getMicrosoftStatus(orgId);
    await updateMicrosoftStatus(orgId, { lastPollAt: new Date().toISOString(), lastError: null, ticketsCreated: (prev?.ticketsCreated ?? 0) + created });
    if (created > 0) logger.info({ orgId, created }, "Microsoft poll: created tickets");
  } catch (err: any) {
    logger.error({ err, orgId }, "Microsoft poll failed");
    await updateMicrosoftStatus(orgId, { lastPollAt: new Date().toISOString(), lastError: err?.message ?? "Errore" });
  }
}

export async function getAllMicrosoftOrgIds(): Promise<number[]> {
  const rows = await db.select().from(settingsTable).where(like(settingsTable.key, "org_%_microsoft_tokens"));
  return rows.map((r) => { const m = r.key.match(/^org_(\d+)_microsoft_tokens$/); return m ? parseInt(m[1], 10) : null; }).filter((id): id is number => id !== null);
}
