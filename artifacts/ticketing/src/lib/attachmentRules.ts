export const ALLOWED_ATTACHMENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.oasis.opendocument.presentation",
  "text/plain",
  "text/csv",
  "application/zip",
  "application/x-zip-compressed",
  "application/gzip",
  "application/x-tar",
  "application/x-7z-compressed",
  "application/x-rar-compressed",
  "application/octet-stream",
] as const;

export const MAX_ATTACHMENT_SIZE_BYTES = 20 * 1024 * 1024;

export function getAttachmentValidationFailure(
  mimeType: string | null | undefined,
  size: number | null | undefined,
): "type" | "size" | null {
  const normalizedMimeType = (mimeType || "application/octet-stream")
    .split(";")[0]
    .trim()
    .toLowerCase();

  if (!ALLOWED_ATTACHMENT_TYPES.includes(normalizedMimeType as typeof ALLOWED_ATTACHMENT_TYPES[number])) {
    return "type";
  }
  if (size != null && size > MAX_ATTACHMENT_SIZE_BYTES) {
    return "size";
  }
  return null;
}
