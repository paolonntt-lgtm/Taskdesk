import { describe, expect, it } from "vitest";
import { getLanguagePreferenceSyncAction } from "./languagePreferenceSync";

describe("language preference synchronization", () => {
  it("applies the authenticated user's saved language over a different local language", () => {
    expect(getLanguagePreferenceSyncAction({
      userId: 10,
      preferredLanguage: "en",
      currentLanguage: "it",
      syncedUserId: null,
    })).toEqual({ type: "apply", language: "en", syncedUserId: 10 });

    expect(getLanguagePreferenceSyncAction({
      userId: 10,
      preferredLanguage: "en",
      currentLanguage: "en",
      syncedUserId: 10,
    })).toEqual({ type: "save", language: "en", syncedUserId: 10 });
  });

  it("keeps the local language and saves it when the profile has no preference", () => {
    expect(getLanguagePreferenceSyncAction({
      userId: 11,
      preferredLanguage: null,
      currentLanguage: "it",
      syncedUserId: null,
    })).toEqual({ type: "save", language: "it", syncedUserId: 11 });
  });

  it("uses the new account's preference instead of carrying over the previous account's language", () => {
    expect(getLanguagePreferenceSyncAction({
      userId: 12,
      preferredLanguage: "it",
      currentLanguage: "en",
      syncedUserId: 10,
    })).toEqual({ type: "apply", language: "it", syncedUserId: 12 });
  });

  it("resets account synchronization state after logout", () => {
    expect(getLanguagePreferenceSyncAction({
      userId: null,
      preferredLanguage: null,
      currentLanguage: "en",
      syncedUserId: 10,
    })).toEqual({ type: "reset", syncedUserId: null });
  });
});
