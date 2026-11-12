export function getCreatedTicketDetailHref(ticketId: number): string {
  return `/ticket/${ticketId}?returnTo=tickets`;
}

export function getTicketDetailBackHref(
  returnTo: string | string[] | undefined,
): "/(tabs)/tickets" | null {
  const destination = Array.isArray(returnTo) ? returnTo[0] : returnTo;
  return destination === "tickets" ? "/(tabs)/tickets" : null;
}
