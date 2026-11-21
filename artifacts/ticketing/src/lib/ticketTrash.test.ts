import { describe, expect, it, vi } from 'vitest';
import { moveTicketToTrash } from './ticketTrash';

describe('moveTicketToTrash', () => {
  it('deletes the ticket, invalidates calendar queries, then completes navigation', async () => {
    const calls: string[] = [];
    const deleteTicket = vi.fn(async ({ id }: { id: number }) => {
      calls.push(`delete:${id}`);
    });
    const invalidateQueries = vi.fn(async ({ queryKey }: { queryKey: readonly unknown[] }) => {
      calls.push(`invalidate:${queryKey[0]}`);
    });
    const onComplete = vi.fn(() => calls.push('navigate'));

    await moveTicketToTrash(42, deleteTicket, invalidateQueries, onComplete);

    expect(deleteTicket).toHaveBeenCalledWith({ id: 42 });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['/api/calendar'] });
    expect(calls).toEqual(['delete:42', 'invalidate:/api/calendar', 'navigate']);
  });

  it('does not invalidate or navigate when deleting the ticket fails', async () => {
    const deleteTicket = vi.fn().mockRejectedValue(new Error('delete failed'));
    const invalidateQueries = vi.fn(async () => {});
    const onComplete = vi.fn();

    await expect(moveTicketToTrash(42, deleteTicket, invalidateQueries, onComplete))
      .rejects.toThrow('delete failed');

    expect(invalidateQueries).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });
});
