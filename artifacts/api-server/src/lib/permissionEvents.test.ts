import { afterEach, describe, expect, it, vi } from "vitest";
import {
  notifyPermissionChanged,
  notifyWorkspaceMembersChanged,
  subscribeToPermissionChanges,
} from "./permissionEvents";

describe("permission change notifications", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("notifies only listeners subscribed to the affected user", () => {
    const affected = vi.fn();
    const other = vi.fn();
    const unsubscribeAffected = subscribeToPermissionChanges(101, affected);
    const unsubscribeOther = subscribeToPermissionChanges(202, other);

    notifyPermissionChanged(101);
    unsubscribeAffected();
    unsubscribeOther();

    expect(affected).toHaveBeenCalledOnce();
    expect(other).not.toHaveBeenCalled();
  });

  it("stops notifying after a listener unsubscribes", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToPermissionChanges(303, listener);

    unsubscribe();
    notifyPermissionChanged(303);

    expect(listener).not.toHaveBeenCalled();
  });

  it("delivers workspace-member changes only to the targeted user", () => {
    const admin = vi.fn();
    const unrelatedUser = vi.fn();
    const unsubscribeAdmin = subscribeToPermissionChanges(404, admin);
    const unsubscribeUnrelated = subscribeToPermissionChanges(505, unrelatedUser);

    notifyWorkspaceMembersChanged(404, 81, "role_changed");
    unsubscribeAdmin();
    unsubscribeUnrelated();

    expect(admin).toHaveBeenCalledWith({
      type: "workspace_members_changed",
      workspaceId: 81,
      change: "role_changed",
    });
    expect(unrelatedUser).not.toHaveBeenCalled();
  });
});
