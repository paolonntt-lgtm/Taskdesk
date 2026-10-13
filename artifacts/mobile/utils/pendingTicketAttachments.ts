import AsyncStorage from "@react-native-async-storage/async-storage";

export interface PendingTicketAttachment {
  name: string;
  uri: string;
  size: number | null;
  mimeType: string;
}

export const MAX_TICKET_ATTACHMENT_SIZE = 20 * 1024 * 1024;

const FILE_MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp",
  pdf: "application/pdf", doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  odp: "application/vnd.oasis.opendocument.presentation",
  txt: "text/plain", csv: "text/csv", zip: "application/zip", gz: "application/gzip",
  tar: "application/x-tar", "7z": "application/x-7z-compressed", rar: "application/x-rar-compressed",
};

const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.oasis.opendocument.text", "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.oasis.opendocument.presentation", "text/plain", "text/csv",
  "application/zip", "application/x-zip-compressed", "application/gzip", "application/x-tar",
  "application/x-7z-compressed", "application/x-rar-compressed", "application/octet-stream",
]);

export function getTicketAttachmentMimeType(name: string, mimeType?: string | null): string {
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  return mimeType || FILE_MIME_BY_EXTENSION[extension] || "application/octet-stream";
}

export function isAllowedTicketAttachmentMimeType(mimeType: string): boolean {
  return ALLOWED_ATTACHMENT_MIME_TYPES.has(mimeType);
}

const storageKey = (ticketId: number | string) =>
  `pending-ticket-attachments:${ticketId}`;

export async function getPendingTicketAttachments(
  ticketId: number | string,
): Promise<PendingTicketAttachment[]> {
  const raw = await AsyncStorage.getItem(storageKey(ticketId));
  if (!raw) return [];

  const parsed: unknown = JSON.parse(raw);
  if (
    !Array.isArray(parsed) ||
    !parsed.every((item) =>
      item &&
      typeof item.name === "string" &&
      typeof item.uri === "string" &&
      (item.size === null || typeof item.size === "number") &&
      typeof item.mimeType === "string"
    )
  ) {
    throw new Error("Invalid pending ticket attachment data");
  }

  return parsed as PendingTicketAttachment[];
}

export async function savePendingTicketAttachments(
  ticketId: number | string,
  attachments: PendingTicketAttachment[],
): Promise<void> {
  const key = storageKey(ticketId);
  if (attachments.length === 0) {
    await AsyncStorage.removeItem(key);
    return;
  }
  await AsyncStorage.setItem(key, JSON.stringify(attachments));
}

export async function replacePendingTicketAttachment(
  ticketId: number | string,
  index: number,
  replacement: PendingTicketAttachment,
): Promise<PendingTicketAttachment[]> {
  const attachments = await getPendingTicketAttachments(ticketId);
  if (index < 0 || index >= attachments.length) {
    throw new Error("Pending attachment no longer exists");
  }

  const updated = attachments.map((attachment, currentIndex) =>
    currentIndex === index ? replacement : attachment
  );
  await savePendingTicketAttachments(ticketId, updated);
  return updated;
}

export function isSamePendingAttachment(
  first: Pick<PendingTicketAttachment, "name" | "size">,
  second: Pick<PendingTicketAttachment, "name" | "size">,
): boolean {
  return first.name === second.name &&
    (first.size == null || second.size == null || first.size === second.size);
}
