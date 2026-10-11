export interface TicketStatusClosure {
  key: string;
  isClosed: boolean;
}

const LEGACY_CLOSED_STATUS_KEYS = ["resolved", "closed"];

export function getClosedTicketStatusKeys(statuses: readonly TicketStatusClosure[]): string[] {
  const configuredKeys = new Set(statuses.map((status) => status.key));
  return [...new Set([
    ...statuses.filter((status) => status.isClosed).map((status) => status.key),
    ...LEGACY_CLOSED_STATUS_KEYS.filter((key) => !configuredKeys.has(key)),
  ])];
}
