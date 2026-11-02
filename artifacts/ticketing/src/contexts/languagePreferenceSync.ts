import type { Lang } from "../i18n/translations";

type LanguagePreferenceSyncInput = {
  userId: number | null | undefined;
  preferredLanguage: unknown;
  currentLanguage: Lang;
  syncedUserId: number | null;
};

type LanguagePreferenceSyncAction =
  | { type: "reset"; syncedUserId: null }
  | { type: "apply"; language: Lang; syncedUserId: number }
  | { type: "save"; language: Lang; syncedUserId: number }
  | { type: "none"; syncedUserId: number };

export function getLanguagePreferenceSyncAction({
  userId,
  preferredLanguage,
  currentLanguage,
  syncedUserId,
}: LanguagePreferenceSyncInput): LanguagePreferenceSyncAction {
  if (!userId) return { type: "reset", syncedUserId: null };

  if (syncedUserId !== userId) {
    if (preferredLanguage === "it" || preferredLanguage === "en") {
      return {
        type: preferredLanguage === currentLanguage ? "none" : "apply",
        language: preferredLanguage,
        syncedUserId: userId,
      };
    }
  }

  return { type: "save", language: currentLanguage, syncedUserId: userId };
}
