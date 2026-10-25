export function canEditTicketDetails({
  isAdmin,
  createdBy,
  currentUserId,
  canChangeStatus,
}: {
  isAdmin: boolean;
  createdBy?: number;
  currentUserId?: number;
  canChangeStatus: boolean;
}): boolean {
  return isAdmin || createdBy === currentUserId || canChangeStatus;
}

export function canViewTicketTrackedTime({
  organizationTrackingEnabled,
  ticketTrackingEnabled,
  canViewSummary,
  isAdmin,
}: {
  organizationTrackingEnabled: boolean;
  ticketTrackingEnabled: boolean;
  canViewSummary: boolean;
  isAdmin: boolean;
}): boolean {
  return organizationTrackingEnabled &&
    ticketTrackingEnabled &&
    (canViewSummary || isAdmin);
}
