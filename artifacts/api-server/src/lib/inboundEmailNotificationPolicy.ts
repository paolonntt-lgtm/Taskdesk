export type InboundEmailNotificationTarget =
  | { kind: "assignee"; userId: number }
  | { kind: "subscribers" };

export function getInboundEmailNotificationTarget(
  assignedTo: number | null,
): InboundEmailNotificationTarget {
  return assignedTo == null
    ? { kind: "subscribers" }
    : { kind: "assignee", userId: assignedTo };
}
