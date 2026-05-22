/**
 * Server-side registry of presigned upload tokens.
 *
 * When the API issues a presigned PUT URL it immediately records the
 * generated objectPath here, bound to the requesting user and org.
 * The attachment-creation handler must call `consumePendingUpload` to
 * prove that the objectPath it receives was legitimately obtained from
 * this server by the same caller — not an arbitrary path the client
 * fabricated or copied from another tenant.
 *
 * Entries expire after UPLOAD_TOKEN_TTL_MS (matches the presigned-URL
 * TTL so a token cannot be replayed after the upload window closes).
 */

const UPLOAD_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes, matches presigned URL TTL

interface PendingUploadEntry {
  userId: number;
  orgId: number | null;
  expiresAt: number;
}

const store = new Map<string, PendingUploadEntry>();

/**
 * Register a freshly-issued objectPath so the attachment handler can
 * later verify it came from this server and belongs to the caller.
 */
export function registerPendingUpload(objectPath: string, userId: number, orgId: number | null): void {
  purgExpired();
  store.set(objectPath, {
    userId,
    orgId,
    expiresAt: Date.now() + UPLOAD_TOKEN_TTL_MS,
  });
}

/**
 * Verify and consume a pending upload entry.
 *
 * Returns `true` and removes the entry when:
 *   - The objectPath was registered by this server.
 *   - The entry has not expired.
 *   - The userId matches the caller who requested the presigned URL.
 *   - The orgId matches (both null counts as a match).
 *
 * Returns `false` in all other cases — the caller must reject the request.
 */
export function consumePendingUpload(objectPath: string, userId: number, orgId: number | null): boolean {
  purgExpired();
  const entry = store.get(objectPath);
  if (!entry) return false;
  if (entry.expiresAt < Date.now()) {
    store.delete(objectPath);
    return false;
  }
  if (entry.userId !== userId) return false;
  if (entry.orgId !== orgId) return false;
  store.delete(objectPath);
  return true;
}

function purgExpired(): void {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiresAt < now) store.delete(key);
  }
}
