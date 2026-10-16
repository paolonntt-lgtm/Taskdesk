export function getTaskTrackAnnouncementStorageKey(userId: string): string {
  return `td_tasktrack_admin_announcement_v1:${userId}`;
}

export function shouldShowTaskTrackAnnouncement({
  userId,
  role,
  location,
  allowed,
  botOpen,
  alreadySeen,
}: {
  userId?: string;
  role?: string;
  location: string;
  allowed: boolean;
  botOpen: boolean;
  alreadySeen: boolean;
}): boolean {
  return Boolean(
    userId &&
    role === 'admin' &&
    location === '/' &&
    allowed &&
    !botOpen &&
    !alreadySeen
  );
}
