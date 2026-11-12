import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  convertLegacyAvatarToThumbnail,
  limitTeamAvatarPayload,
  MAX_PROFILE_AVATAR_LENGTH,
  MAX_TEAM_AVATAR_PAYLOAD_LENGTH,
} from "./avatar";

describe("limitTeamAvatarPayload", () => {
  it("keeps list photo data within the total payload budget", () => {
    const users = Array.from({ length: 11 }, (_, id) => ({
      id,
      avatarUrl: "a".repeat(MAX_PROFILE_AVATAR_LENGTH),
    }));

    const result = limitTeamAvatarPayload(users);

    expect(result.slice(0, 10).every((user) => user.avatarUrl !== null)).toBe(true);
    expect(result[10].avatarUrl).toBeNull();
    expect(result.reduce((total, user) => total + (user.avatarUrl?.length ?? 0), 0))
      .toBeLessThanOrEqual(MAX_TEAM_AVATAR_PAYLOAD_LENGTH);
  });

  it("omits individual legacy photos larger than the per-photo limit", () => {
    const result = limitTeamAvatarPayload([
      { id: 1, avatarUrl: "a".repeat(MAX_PROFILE_AVATAR_LENGTH + 1) },
      { id: 2, avatarUrl: "small-photo" },
    ]);

    expect(result.map((user) => user.avatarUrl)).toEqual([null, "small-photo"]);
  });
});

describe("convertLegacyAvatarToThumbnail", () => {
  it("converts an oversized image into a compact team-list thumbnail", async () => {
    const pixels = Buffer.alloc(400 * 400 * 3);
    for (let i = 0; i < pixels.length; i++) pixels[i] = (i * 73 + (i >> 4)) % 256;
    const original = await sharp(pixels, {
      raw: { width: 400, height: 400, channels: 3 },
    }).jpeg({ quality: 100 }).toBuffer();
    const source = `data:image/jpeg;base64,${original.toString("base64")}`;
    expect(source.length).toBeGreaterThan(MAX_PROFILE_AVATAR_LENGTH);

    const thumbnail = await convertLegacyAvatarToThumbnail(source);

    expect(thumbnail).not.toBeNull();
    expect(thumbnail!.length).toBeLessThanOrEqual(MAX_PROFILE_AVATAR_LENGTH);
    const converted = await sharp(Buffer.from(thumbnail!.split(",")[1], "base64")).metadata();
    expect(converted.width).toBeLessThanOrEqual(256);
    expect(converted.height).toBeLessThanOrEqual(256);
  });

  it("leaves unsupported and corrupt legacy image data unchanged", async () => {
    await expect(convertLegacyAvatarToThumbnail("data:image/svg+xml;base64,PHN2Zz4="))
      .resolves.toBeNull();
    await expect(convertLegacyAvatarToThumbnail("data:image/jpeg;base64,not-an-image"))
      .resolves.toBeNull();
  });
});
