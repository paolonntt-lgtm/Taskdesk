/**
 * Per-user rate limiter for presigned upload URL requests.
 *
 * The Replit sidecar signing API issues generic PUT URLs with no
 * Content-Length constraint, so an attacker can obtain a URL for a small
 * allowed file and then upload arbitrarily large payloads directly to GCS.
 * Server-side declared-size validation cannot prevent this because the upload
 * goes directly from the client to GCS, bypassing the application server.
 *
 * This rate limiter bounds the attack surface: even if each issued URL
 * permits a large upload, limiting the number of URLs any one user can obtain
 * per time window caps the total orphaned storage they can create.
 *
 * Combined with the orphaned-upload cleanup job (20-minute sweep), the
 * maximum persistent orphaned storage per user is bounded by:
 *   MAX_REQUESTS_PER_WINDOW × MAX_UPLOAD_SIZE_BYTES
 */

const WINDOW_MS = 5 * 60 * 1000; // 5-minute sliding window
const MAX_REQUESTS_PER_WINDOW = 20; // max upload URL requests per user per window

interface WindowEntry {
  count: number;
  windowStart: number;
}

const store = new Map<number, WindowEntry>();

/**
 * Check whether the given user is within their upload-URL rate limit.
 * Increments the counter if allowed.
 *
 * @returns `true` if the request is within quota, `false` if it should be
 *          rejected with 429 Too Many Requests.
 */
export function checkAndIncrementUploadRateLimit(userId: number): boolean {
  pruneExpired();

  const now = Date.now();
  const entry = store.get(userId);

  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    store.set(userId, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  entry.count += 1;
  return true;
}

function pruneExpired(): void {
  const now = Date.now();
  for (const [userId, entry] of store) {
    if (now - entry.windowStart >= WINDOW_MS) {
      store.delete(userId);
    }
  }
}
