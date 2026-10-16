export type NewTicketAssignmentMode = 'user' | 'group';

export interface NewTicketAssociationInput {
  clientId: string;
  assignMode: NewTicketAssignmentMode;
  assignedTo: string;
  assignedToGroup: string;
}

export function buildNewTicketAssociations({
  clientId,
  assignMode,
  assignedTo,
  assignedToGroup,
}: NewTicketAssociationInput) {
  return {
    clientId: clientId ? Number.parseInt(clientId, 10) : null,
    assignedTo: assignMode === 'user' && assignedTo ? Number.parseInt(assignedTo, 10) : null,
    assignedToGroup: assignMode === 'group' && assignedToGroup ? assignedToGroup : null,
  };
}
