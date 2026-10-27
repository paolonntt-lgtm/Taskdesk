import { afterEach, describe, expect, it, vi } from "vitest";
import { microsoftOneDriveCallbackUri } from "./appUrl";

describe("Microsoft OneDrive callback URI configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the exact configured URI regardless of Replit request-host settings", () => {
    vi.stubEnv("MICROSOFT_ONEDRIVE_REDIRECT_URI", "https://taskdesk.it/api/onedrive/callback");
    vi.stubEnv("REPLIT_DOMAINS", "unregistered-preview.example");
    vi.stubEnv("REPLIT_DEV_DOMAIN", "another-preview.example");

    expect(microsoftOneDriveCallbackUri()).toBe("https://taskdesk.it/api/onedrive/callback");
  });

  it("rejects a missing callback URI with setup guidance", () => {
    vi.stubEnv("MICROSOFT_ONEDRIVE_REDIRECT_URI", "");

    expect(() => microsoftOneDriveCallbackUri())
      .toThrow("MICROSOFT_ONEDRIVE_REDIRECT_URI");
  });

  it.each([
    "not-a-url",
    "http://taskdesk.it/api/onedrive/callback",
    "https://taskdesk.it/other/callback",
    "https://user@taskdesk.it/api/onedrive/callback",
    "https://taskdesk.it/api/onedrive/callback?next=/app/",
    "https://taskdesk.it/api/onedrive/callback#fragment",
  ])("rejects an invalid callback URI: %s", (uri) => {
    vi.stubEnv("MICROSOFT_ONEDRIVE_REDIRECT_URI", uri);

    expect(() => microsoftOneDriveCallbackUri()).toThrow("MICROSOFT_ONEDRIVE_REDIRECT_URI");
  });
});
