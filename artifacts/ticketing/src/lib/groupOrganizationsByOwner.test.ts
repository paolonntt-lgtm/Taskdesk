import { describe, expect, it } from "vitest";
import { groupOrganizationsByOwner } from "./groupOrganizationsByOwner";

describe("groupOrganizationsByOwner", () => {
  it("groups a billing organization with its shared workspaces, not other organizations with common admins", () => {
    const organizations = [
      { id: 1, name: "La Mandrakata", billingOwnerOrganizationId: null, adminUsers: ["paolonntt@gmail.com"] },
      { id: 1127, name: "Prova2", billingOwnerOrganizationId: 1, adminUsers: ["paolonntt@gmail.com", "enrico@example.com"] },
      { id: 1235, name: "rreee", billingOwnerOrganizationId: 1, adminUsers: ["paolonntt@gmail.com"] },
      { id: 10, name: "Studio Iannetti", billingOwnerOrganizationId: null, adminUsers: ["enrico@example.com"] },
    ];

    const groups = groupOrganizationsByOwner(organizations);

    expect(groups.map((group) => group.organizations.map((org) => org.id))).toEqual([
      [1, 1127, 1235],
      [10],
    ]);
    expect(groups[0].ownerName).toBe("La Mandrakata");
  });

  it("keeps unrelated organizations separate when they have no billing owner link", () => {
    const organizations = [
      { id: 3, name: "A", billingOwnerOrganizationId: null },
      { id: 4, name: "B", billingOwnerOrganizationId: null },
    ];

    const groups = groupOrganizationsByOwner(organizations);

    expect(groups).toHaveLength(2);
  });
});
