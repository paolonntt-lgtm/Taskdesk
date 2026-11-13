export function getTicketIdFromNotificationResponse(response: unknown): number | null {
  if (!response || typeof response !== "object") return null;

  const notification = (response as {
    notification?: {
      request?: {
        content?: { data?: { ticketId?: unknown } };
      };
    };
  }).notification;
  const rawTicketId = notification?.request?.content?.data?.ticketId;
  const ticketId = typeof rawTicketId === "string" && /^\d+$/.test(rawTicketId)
    ? Number(rawTicketId)
    : rawTicketId;

  return typeof ticketId === "number" && Number.isSafeInteger(ticketId) && ticketId > 0
    ? ticketId
    : null;
}

export function getNotificationResponseKey(response: unknown): string | null {
  if (!response || typeof response !== "object") return null;

  const value = response as {
    actionIdentifier?: unknown;
    notification?: { request?: { identifier?: unknown } };
  };
  const identifier = value.notification?.request?.identifier;
  if (typeof identifier !== "string" || identifier.length === 0) return null;

  const action = typeof value.actionIdentifier === "string" ? value.actionIdentifier : "";
  return `${identifier}:${action}`;
}
