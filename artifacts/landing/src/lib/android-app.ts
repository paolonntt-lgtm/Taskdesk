export const ANDROID_PLAY_STORE_URL =
  import.meta.env.VITE_ANDROID_PLAY_STORE_URL?.trim() ?? "";

export function isAndroidPhone(): boolean {
  return typeof navigator !== "undefined" &&
    /android/i.test(navigator.userAgent) &&
    /mobile/i.test(navigator.userAgent);
}
