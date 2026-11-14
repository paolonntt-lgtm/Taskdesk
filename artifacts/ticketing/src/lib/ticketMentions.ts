export interface MentionUser {
  id: number;
  name: string;
}

function normalizeMentionName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function resolveMentionUser(
  mentionName: string,
  users: readonly MentionUser[] | undefined,
): MentionUser | undefined {
  const normalizedName = normalizeMentionName(mentionName);
  if (!normalizedName) return undefined;

  const matches = (users ?? []).filter(
    (user) => normalizeMentionName(user.name) === normalizedName,
  );
  return matches.length === 1 ? matches[0] : undefined;
}
