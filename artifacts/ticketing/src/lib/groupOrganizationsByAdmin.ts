export interface OrganizationWithOwner {
  id: number;
  name: string;
  billingOwnerOrganizationId: number | null;
}

export interface OrganizationAdminGroup<T extends OrganizationWithOwner> {
  key: string;
  organizations: T[];
  ownerName: string;
}

export function groupOrganizationsByOwner<T extends OrganizationWithOwner>(
  organizations: T[],
): OrganizationAdminGroup<T>[] {
  const organizationsById = new Map(organizations.map((organization) => [organization.id, organization]));
  const grouped = new Map<number, T[]>();

  for (const organization of organizations) {
    const ownerId = organization.billingOwnerOrganizationId ?? organization.id;
    const members = grouped.get(ownerId) ?? [];
    members.push(organization);
    grouped.set(ownerId, members);
  }

  const groups: OrganizationAdminGroup<T>[] = [];

  for (const [ownerId, members] of grouped) {
    const owner = organizationsById.get(ownerId);
    groups.push({
      key: members.map(({ id }) => id).sort((a, b) => a - b).join("-"),
      organizations: members,
      ownerName: owner?.name ?? members[0].name,
    });
  }

  return groups;
}
