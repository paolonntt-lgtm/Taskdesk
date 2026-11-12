export const MAX_PROFILE_AVATAR_LENGTH = 100_000;
export const MAX_TEAM_AVATAR_PAYLOAD_LENGTH = 1_000_000;

const MAX_LEGACY_AVATAR_BYTES = 20 * 1024 * 1024;
const THUMBNAIL_SIZES = [
  { width: 256, quality: 76 },
  { width: 192, quality: 64 },
  { width: 128, quality: 52 },
];

export async function convertLegacyAvatarToThumbnail(avatarUrl: string): Promise<string | null> {
  const match = /^data:image\/(?:jpeg|png|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/.exec(avatarUrl);
  if (!match) return null;

  const input = Buffer.from(match[1], "base64");
  if (input.length === 0 || input.length > MAX_LEGACY_AVATAR_BYTES) return null;

  try {
    const sharp = (await import("sharp")).default;
    const image = sharp(input, { limitInputPixels: 40_000_000, failOn: "error" }).rotate();

    for (const { width, quality } of THUMBNAIL_SIZES) {
      const thumbnail = await image
        .clone()
        .resize({ width, height: width, fit: "inside", withoutEnlargement: true })
        .flatten({ background: "#ffffff" })
        .jpeg({ quality })
        .toBuffer();
      const dataUrl = `data:image/jpeg;base64,${thumbnail.toString("base64")}`;
      if (dataUrl.length <= MAX_PROFILE_AVATAR_LENGTH) return dataUrl;
    }
  } catch {
    // Unsupported or corrupt legacy images stay untouched in storage.
  }

  return null;
}

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
