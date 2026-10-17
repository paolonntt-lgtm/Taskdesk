import { describe, expect, it } from 'vitest';
import { isTicketDataQuery } from './clientNameCache';

describe('isTicketDataQuery', () => {
  it('matches ticket lists with any filters and individual ticket details', () => {
    expect(isTicketDataQuery(['/api/tickets'])).toBe(true);
    expect(isTicketDataQuery(['/api/tickets', { clientId: 42 }])).toBe(true);
    expect(isTicketDataQuery(['/api/tickets/123'])).toBe(true);
  });

  it('does not invalidate unrelated ticket subresources or client queries', () => {
    expect(isTicketDataQuery(['/api/tickets/123/comments'])).toBe(false);
    expect(isTicketDataQuery(['/api/clients/42'])).toBe(false);
  });
});
