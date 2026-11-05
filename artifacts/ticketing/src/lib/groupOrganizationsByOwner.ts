export interface OrganizationWithOwner {
  id: number;
  name: string;
  billingOwnerOrganizationId: number | null;
}

export interface OrganizationOwnerGroup<T extends OrganizationWithOwner> {
  key: string;
  organizations: T[];
  ownerName: string;
}

export function groupOrganizationsByOwner<T extends OrganizationWithOwner>(
  organizations: T[],
): OrganizationOwnerGroup<T>[] {
  const organizationsById = new Map(organizations.map((organization) => [organization.id, organization]));
  const grouped = new Map<number, T[]>();

  for (const organization of organizations) {
    const ownerId = organization.billingOwnerOrganizationId ?? organization.id;
    const members = grouped.get(ownerId) ?? [];
    members.push(organization);
    grouped.set(ownerId, members);
  }

  return Array.from(grouped, ([ownerId, members]) => ({
    key: members.map(({ id }) => id).sort((a, b) => a - b).join("-"),
    organizations: members,
    ownerName: organizationsById.get(ownerId)?.name ?? members[0].name,
  }));
}
