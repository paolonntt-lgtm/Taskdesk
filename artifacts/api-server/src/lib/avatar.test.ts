import { describe, expect, it } from "vitest";
import {
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
