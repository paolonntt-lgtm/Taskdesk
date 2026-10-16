import { describe, expect, it } from 'vitest';
import { buildNewTicketAssociations } from './newTicketAssociations';

describe('new ticket TaskTrack associations', () => {
  it.each([
    {
      name: 'client only',
      input: { clientId: '18', assignMode: 'user' as const, assignedTo: '', assignedToGroup: '' },
      expected: { clientId: 18, assignedTo: null, assignedToGroup: null },
    },
    {
      name: 'individual collaborator only',
      input: { clientId: '', assignMode: 'user' as const, assignedTo: '42', assignedToGroup: '' },
      expected: { clientId: null, assignedTo: 42, assignedToGroup: null },
    },
    {
      name: 'client and individual collaborator',
      input: { clientId: '18', assignMode: 'user' as const, assignedTo: '42', assignedToGroup: '' },
      expected: { clientId: 18, assignedTo: 42, assignedToGroup: null },
    },
    {
      name: 'neither selection',
      input: { clientId: '', assignMode: 'user' as const, assignedTo: '', assignedToGroup: '' },
      expected: { clientId: null, assignedTo: null, assignedToGroup: null },
    },
  ])('builds a consistent creation payload for $name', ({ input, expected }) => {
    expect(buildNewTicketAssociations(input)).toEqual(expected);
  });

  it('never sends an individual assignment together with a group assignment', () => {
    expect(buildNewTicketAssociations({
      clientId: '',
      assignMode: 'group',
      assignedTo: '42',
      assignedToGroup: 'Support',
    })).toEqual({
      clientId: null,
      assignedTo: null,
      assignedToGroup: 'Support',
    });
  });
});
