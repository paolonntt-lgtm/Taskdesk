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
  const isCreator =
    createdBy != null &&
    currentUserId != null &&
    createdBy === currentUserId;

  return isAdmin || isCreator || canChangeStatus;
}

export function canEditTicketTracking({
  isAdmin,
  trackingModuleEnabled,
}: {
  isAdmin: boolean;
  trackingModuleEnabled: boolean;
}): boolean {
  return isAdmin && trackingModuleEnabled;
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
