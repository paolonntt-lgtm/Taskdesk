import AsyncStorage from "@react-native-async-storage/async-storage";

export interface PendingTicketAttachment {
  name: string;
  uri: string;
  size: number | null;
  mimeType: string;
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

export function isSamePendingAttachment(
  first: Pick<PendingTicketAttachment, "name" | "size">,
  second: Pick<PendingTicketAttachment, "name" | "size">,
): boolean {
  return first.name === second.name &&
    (first.size == null || second.size == null || first.size === second.size);
}
