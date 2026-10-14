import { afterEach, describe, expect, it, vi } from "vitest";
import {
  notifyPermissionChanged,
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
});
