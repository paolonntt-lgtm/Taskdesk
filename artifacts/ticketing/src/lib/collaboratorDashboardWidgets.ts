export type DashboardCollaborator = {
  id: number;
  role?: string | null;
  isActive?: boolean | null;
};

const COLLABORATOR_WIDGET_PREFIX = "feed-person__collaborator-";

export function getCollaboratorWidgetInstanceId(collaboratorId: number): string {
  return `${COLLABORATOR_WIDGET_PREFIX}${collaboratorId}`;
}

export function getCollaboratorIdFromWidgetInstanceId(instanceId: string): number | null {
  if (!instanceId.startsWith(COLLABORATOR_WIDGET_PREFIX)) return null;
  const collaboratorId = Number(instanceId.slice(COLLABORATOR_WIDGET_PREFIX.length));
  return Number.isInteger(collaboratorId) && collaboratorId > 0 ? collaboratorId : null;
}

export function getDashboardCollaboratorWidgetIds(
  users: readonly DashboardCollaborator[] | undefined,
  currentUserId: number | string | null | undefined,
): string[] {
  const viewerId = currentUserId == null ? null : Number(currentUserId);
  return (users ?? [])
    .filter((user) =>
      user.id !== viewerId
      && user.role !== "admin"
      && user.isActive !== false
      && Number.isInteger(user.id)
      && user.id > 0,
    )
    .map((user) => getCollaboratorWidgetInstanceId(user.id));
}

export function getMissingCollaboratorWidgetIds(
  targetIds: readonly string[],
  visibleIds: readonly string[],
  dismissedIds: readonly string[],
): string[] {
  const visible = new Set(visibleIds);
  const dismissed = new Set(dismissedIds);
  return targetIds.filter((id) => !visible.has(id) && !dismissed.has(id));
}
