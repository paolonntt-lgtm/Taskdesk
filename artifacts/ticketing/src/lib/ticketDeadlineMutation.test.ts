import { describe, expect, it, vi } from 'vitest';
import { saveTicketDeadline } from './ticketDeadlineMutation';

describe('saveTicketDeadline', () => {
  it('saves the deadline and refreshes the ticket, list, and calendar queries', async () => {
    const updateTicket = vi.fn(async () => undefined);
    const invalidateQueries = vi.fn(async () => undefined);
    const ticketQueryKey = ['/api/tickets', 42];
    const ticketListQueryKey = ['/api/tickets'];

    await saveTicketDeadline({
      ticketId: 42,
      value: '2026-11-21T15:30',
      updateTicket,
      invalidateQueries,
      ticketQueryKey,
      ticketListQueryKey,
    });

    expect(updateTicket).toHaveBeenCalledWith({
      id: 42,
      data: { dueAt: new Date('2026-11-21T15:30').toISOString() },
    });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ticketQueryKey });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ticketListQueryKey });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['/api/calendar'] });
  });

  it('clears the deadline and does not refresh queries if saving fails', async () => {
    const updateTicket = vi.fn().mockRejectedValue(new Error('save failed'));
    const invalidateQueries = vi.fn(async () => undefined);

    await expect(saveTicketDeadline({
      ticketId: 42,
      value: '',
      updateTicket,
      invalidateQueries,
      ticketQueryKey: ['/api/tickets', 42],
      ticketListQueryKey: ['/api/tickets'],
    })).rejects.toThrow('save failed');

    expect(updateTicket).toHaveBeenCalledWith({
      id: 42,
      data: { dueAt: null },
    });
    expect(invalidateQueries).not.toHaveBeenCalled();
  });
});
