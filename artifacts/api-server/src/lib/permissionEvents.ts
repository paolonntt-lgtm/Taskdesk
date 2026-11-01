export type PermissionEvent =
  | { type: "permissions_changed" }
  | {
      type: "workspace_members_changed";
      workspaceId: number;
      change: "added" | "removed" | "role_changed";
    };

type PermissionChangeListener = (event: PermissionEvent) => void;

const listenersByUser = new Map<number, Set<PermissionChangeListener>>();

export function subscribeToPermissionChanges(
  userId: number,
  listener: PermissionChangeListener,
): () => void {
  const listeners = listenersByUser.get(userId) ?? new Set<PermissionChangeListener>();
  listeners.add(listener);
  listenersByUser.set(userId, listeners);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) listenersByUser.delete(userId);
  };
}

export function notifyPermissionChanged(userId: number): void {
  for (const listener of [...(listenersByUser.get(userId) ?? [])]) {
    listener({ type: "permissions_changed" });
  }
}

export function notifyWorkspaceMembersChanged(
  userId: number,
  workspaceId: number,
  change: "added" | "removed" | "role_changed",
): void {
  for (const listener of [...(listenersByUser.get(userId) ?? [])]) {
    listener({ type: "workspace_members_changed", workspaceId, change });
  }
}
