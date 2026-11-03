import { describe, expect, it } from "vitest";
import {
  getCollaboratorIdFromWidgetInstanceId,
  getCollaboratorWidgetInstanceId,
  getDashboardCollaboratorWidgetIds,
  getMissingCollaboratorWidgetIds,
} from "./collaboratorDashboardWidgets";

describe("automatic collaborator dashboard widgets", () => {
  it("creates one stable widget for each active collaborator, excluding admins and the viewer", () => {
    expect(getDashboardCollaboratorWidgetIds([
      { id: 1, role: "admin", isActive: true },
      { id: 2, role: "collaborator", isActive: true },
      { id: 3, role: "collaborator", isActive: false },
      { id: 4, role: "collaborator", isActive: null },
    ], 1)).toEqual([
      getCollaboratorWidgetInstanceId(2),
      getCollaboratorWidgetInstanceId(4),
    ]);
  });

  it("round-trips the collaborator id from its widget instance id", () => {
    const instanceId = getCollaboratorWidgetInstanceId(42);
    expect(getCollaboratorIdFromWidgetInstanceId(instanceId)).toBe(42);
    expect(getCollaboratorIdFromWidgetInstanceId("feed-person__1730000000000")).toBeNull();
    expect(getCollaboratorIdFromWidgetInstanceId("feed-person__collaborator-nope")).toBeNull();
  });

  it("does not recreate widgets the user already has or dismissed", () => {
    const ids = [
      getCollaboratorWidgetInstanceId(12),
      getCollaboratorWidgetInstanceId(13),
      getCollaboratorWidgetInstanceId(14),
    ];
    expect(getMissingCollaboratorWidgetIds(
      ids,
      [ids[0]],
      [ids[1]],
    )).toEqual([ids[2]]);
  });
});
