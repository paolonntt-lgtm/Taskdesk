export interface OrganizationAdmin {
  id: number;
  name: string;
  email: string;
}

export interface OrganizationWithAdmins {
  id: number;
  adminUsers?: OrganizationAdmin[];
}

export interface OrganizationAdminGroup<T extends OrganizationWithAdmins> {
  key: string;
  organizations: T[];
  admins: OrganizationAdmin[];
}

export function groupOrganizationsByAdmin<T extends OrganizationWithAdmins>(
  organizations: T[],
): OrganizationAdminGroup<T>[] {
  const remaining = new Map(organizations.map((organization) => [organization.id, organization]));
  const groups: OrganizationAdminGroup<T>[] = [];
  const accountKey = (admin: OrganizationAdmin) => admin.email.trim().toLowerCase();

  while (remaining.size > 0) {
    const first = remaining.values().next().value as T;
    remaining.delete(first.id);
    const members = [first];
    const admins = new Map<string, OrganizationAdmin>();
    for (const admin of first.adminUsers ?? []) {
      const key = accountKey(admin);
      if (key) admins.set(key, admin);
    }

    let changed = true;
    while (changed) {
      changed = false;
      for (const [id, candidate] of remaining) {
        const candidateAdmins = candidate.adminUsers ?? [];
        if (!candidateAdmins.some((admin) => admins.has(accountKey(admin)))) continue;
        remaining.delete(id);
        members.push(candidate);
        for (const admin of candidateAdmins) {
          const key = accountKey(admin);
          if (key) admins.set(key, admin);
        }
        changed = true;
      }
    }

    groups.push({
      key: members.map(({ id }) => id).sort((a, b) => a - b).join("-"),
      organizations: members,
      admins: Array.from(admins.values()),
    });
  }

  return groups;
}
