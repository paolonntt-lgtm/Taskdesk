export const MAX_PROFILE_AVATAR_LENGTH = 100_000;
export const MAX_TEAM_AVATAR_PAYLOAD_LENGTH = 1_000_000;

export function limitTeamAvatarPayload<T extends { avatarUrl: string | null }>(
  users: T[],
): T[] {
  let remaining = MAX_TEAM_AVATAR_PAYLOAD_LENGTH;

  return users.map((user) => {
    const avatarUrl = user.avatarUrl;
    if (!avatarUrl || avatarUrl.length > MAX_PROFILE_AVATAR_LENGTH || avatarUrl.length > remaining) {
      return { ...user, avatarUrl: null };
    }

    remaining -= avatarUrl.length;
    return user;
  });
}
