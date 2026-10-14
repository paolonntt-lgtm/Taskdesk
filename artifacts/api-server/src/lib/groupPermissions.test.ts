import { describe, expect, it } from "vitest";
import {
  parsePermissionOverrides,
  resolvePermissionSummary,
} from "./groupPermissions";

describe("permission override resolution", () => {
  it("inherits the union of group permissions when no override exists", () => {
    const summary = resolvePermissionSummary("user", ["add_notes", "create_appointments"], {});
    expect(summary.inheritedGroupPermissions).toEqual(["add_notes", "create_appointments"]);
    expect(summary.effectivePermissions).toEqual(["add_notes", "create_appointments"]);
  });

  it("lets an individual denial override a group grant and grants missing group permissions", () => {
    const summary = resolvePermissionSummary(
      "user",
      ["add_notes", "edit_fixed_notes"],
      { add_notes: "deny", create_appointments: "grant", edit_fixed_notes: "inherit" },
    );
    expect(summary.effectivePermissions).toEqual(["edit_fixed_notes", "create_appointments"]);
  });

  it("keeps every catalog permission for admins regardless of overrides", () => {
    const summary = resolvePermissionSummary("admin", [], { add_notes: "deny" });
    expect(summary.effectivePermissions).toHaveLength(9);
    expect(summary.effectivePermissions).toContain("add_notes");
  });

  it("ignores malformed and unsupported persisted override values", () => {
    expect(parsePermissionOverrides('{"add_notes":"deny","unknown":"grant","edit_fixed_notes":"maybe"}'))
      .toEqual({ add_notes: "deny" });
  });
});
