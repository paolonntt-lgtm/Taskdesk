type DeleteTicket = (input: { id: number }) => Promise<unknown>;
type InvalidateQueries = (filters: { queryKey: readonly unknown[] }) => Promise<unknown>;

export async function moveTicketToTrash(
  ticketId: number,
  deleteTicket: DeleteTicket,
  invalidateQueries: InvalidateQueries,
  onComplete: () => void,
): Promise<void> {
  await deleteTicket({ id: ticketId });
  await invalidateQueries({ queryKey: ['/api/calendar'] });
  onComplete();
}
