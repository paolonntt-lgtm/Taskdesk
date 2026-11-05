import { describe, expect, it } from "vitest";
import { groupOrganizationsByAdmin } from "./groupOrganizationsByAdmin";

describe("groupOrganizationsByAdmin", () => {
  it("groups organizations by the same admin account email, ignoring email case", () => {
    const organizations = [
      { id: 1, adminUsers: [{ id: 10, name: "Paolo", email: "paolonntt@gmail.com" }] },
      { id: 2, adminUsers: [{ id: 21, name: "Paolo", email: "PaoloNNTT@gmail.com" }] },
      { id: 3, adminUsers: [{ id: 30, name: "Other", email: "other@example.com" }] },
    ];

    const groups = groupOrganizationsByAdmin(organizations);

    expect(groups.map((group) => group.organizations.map((org) => org.id))).toEqual([[1, 2], [3]]);
  });

  it("keeps the existing transitive grouping for organizations sharing admin accounts", () => {
    const organizations = [
      {
        id: 1,
        adminUsers: [
          { id: 10, name: "Paolo", email: "paolo@example.com" },
          { id: 11, name: "Anna", email: "anna@example.com" },
        ],
      },
      { id: 2, adminUsers: [{ id: 12, name: "Anna", email: "anna@example.com" }] },
      { id: 3, adminUsers: [{ id: 13, name: "Paolo", email: "paolo@example.com" }] },
    ];

    const groups = groupOrganizationsByAdmin(organizations);

    expect(groups).toHaveLength(1);
    expect(groups[0].organizations.map((org) => org.id)).toEqual([1, 2, 3]);
  });
});
