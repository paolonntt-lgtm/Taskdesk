/**
 * Server-side allowlist for attachment MIME types.
 *
 * Only types in this set may be accepted at the upload-URL request stage
 * and at the attachment-save stage. Active content types that could execute
 * scripts in a browser (text/html, image/svg+xml, text/javascript, etc.)
 * are intentionally excluded.
 *
 * This list is intentionally tight. Any type not listed here is rejected
 * regardless of what the client claims.
 */
export const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  // Raster images — rendered inline, no script execution risk
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  // NOTE: image/svg+xml is excluded — SVG can contain embedded <script> elements

  // Documents
  "application/pdf",

  // Microsoft Office (modern + legacy)
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",

  // OpenDocument
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.oasis.opendocument.presentation",

  // Plain text and CSV — safe because not parsed as active web content
  "text/plain",
  "text/csv",

  // Archives
  "application/zip",
  "application/x-zip-compressed",
  "application/gzip",
  "application/x-tar",
  "application/x-7z-compressed",
  "application/x-rar-compressed",

  // Generic binary — used as a fallback when the real type is unknown
  "application/octet-stream",
]);

/**
 * Maximum allowed upload size in bytes (50 MB).
 * Enforced server-side at the URL-request stage so callers cannot bypass it
 * by skipping the browser UI and calling the API directly.
 */
export const MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024;

/**
 * MIME types that browsers will render or execute as web content when
 * opened in a new tab. Files with these stored types must be served with
 * Content-Disposition: attachment and the Content-Type overridden to
 * application/octet-stream to prevent stored-XSS via the download endpoint.
 *
 * The allowlist above already prevents these types from being saved, but
 * this set provides a second layer of defence for any objects that may have
 * been stored before the allowlist was introduced, or that arrive via the
 * inbound-email path with attacker-controlled headers.
 */
export const ACTIVE_CONTENT_MIME_TYPES = new Set([
  "text/html",
  "text/xml",
  "application/xhtml+xml",
  "image/svg+xml",
  "text/javascript",
  "application/javascript",
  "application/x-javascript",
  "application/json",
  "application/xml",
]);
