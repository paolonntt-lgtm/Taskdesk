type UpdateTicket = (input: {
  id: number;
  data: { dueAt: string | null };
}) => Promise<unknown>;

type InvalidateQueries = (filters: {
  queryKey: readonly unknown[];
}) => Promise<unknown>;

interface SaveTicketDeadlineOptions {
  ticketId: number;
  value: string;
  updateTicket: UpdateTicket;
  invalidateQueries: InvalidateQueries;
  ticketQueryKey: readonly unknown[];
  ticketListQueryKey: readonly unknown[];
}

export async function saveTicketDeadline({
  ticketId,
  value,
  updateTicket,
  invalidateQueries,
  ticketQueryKey,
  ticketListQueryKey,
}: SaveTicketDeadlineOptions): Promise<void> {
  await updateTicket({
    id: ticketId,
    data: { dueAt: value ? new Date(value).toISOString() : null },
  });

  await Promise.all([
    invalidateQueries({ queryKey: ticketQueryKey }),
    invalidateQueries({ queryKey: ticketListQueryKey }),
    invalidateQueries({ queryKey: ['/api/calendar'] }),
  ]);
}
