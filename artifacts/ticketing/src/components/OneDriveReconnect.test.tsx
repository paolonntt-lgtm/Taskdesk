// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const oneDriveApi = vi.hoisted(() => ({
  listOneDriveSharedWithMe: vi.fn(),
  listSharedOneDriveFolderItems: vi.fn(),
  previewSharedOneDriveItem: vi.fn(),
}));

const languageState = vi.hoisted(() => ({ value: null as any }));

vi.mock("@workspace/api-client-react", () => oneDriveApi);
vi.mock("../contexts/LanguageContext", () => ({
  useLanguage: () => languageState.value,
}));
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: 12, role: "admin" } }),
}));

import OneDriveConnectionSettings from "./OneDriveConnectionSettings";
import OneDrivePage from "../pages/OneDrive";
import { translations } from "../i18n/translations";

describe("OneDrive reconnect guidance", () => {
  let host: HTMLDivElement;
  let root: Root;
  let fetchMock: ReturnType<typeof vi.fn>;
  let openMock: ReturnType<typeof vi.spyOn>;

  const render = async (component: React.ReactNode) => {
    await act(async () => {
      root.render(component);
    });
  };

  const fetchResponse = (body: unknown, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });

  const clickButton = async (label: string) => {
    const button = Array.from(document.querySelectorAll("button"))
      .find((candidate) => candidate.textContent?.trim() === label);
    if (!button) throw new Error(`Missing button: ${label}`);
    await act(async () => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
  };

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    languageState.value = { lang: "en", t: translations.en, setLang: vi.fn() };
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    oneDriveApi.listOneDriveSharedWithMe.mockReset().mockResolvedValue([]);
    oneDriveApi.listSharedOneDriveFolderItems.mockReset();
    oneDriveApi.previewSharedOneDriveItem.mockReset();
    fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/onedrive/connection") {
        return fetchResponse({ connected: true, microsoftEmail: "saved@example.test" });
      }
      if (url === "/api/onedrive/client-archive") {
        return fetchResponse({ configured: false, clients: [] });
      }
      if (url === "/api/onedrive/client-archive/backfill") {
        return fetchResponse(null, 404);
      }
      if (url === "/api/onedrive/organization-shares") return fetchResponse([]);
      return fetchResponse({ error: "Unexpected request" }, 404);
    });
    vi.stubGlobal("fetch", fetchMock);
    openMock = vi.spyOn(window, "open").mockReturnValue({ opener: null } as WindowProxy);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    host.remove();
  });

  it("keeps the saved settings account visible and offers same-account reconnect", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input) === "/api/onedrive/connection") {
        return fetchResponse({
          connected: true,
          microsoftEmail: "saved@example.test",
          reconnectRequired: true,
        });
      }
      if (String(input) === "/api/onedrive/client-archive") {
        return fetchResponse({ configured: false });
      }
      return fetchResponse({}, 404);
    });

    await render(<OneDriveConnectionSettings />);

    expect(host.textContent).toContain("saved@example.test");
    expect(host.textContent).toContain(translations.en.settings.oneDriveReconnectRequired);
    expect(host.textContent).toContain(translations.en.settings.oneDriveReconnectSameAccount);
    expect(host.textContent).not.toContain(translations.en.settings.oneDriveSwitchAccount);

    await clickButton(translations.en.settings.oneDriveReconnectSameAccount);
    expect(openMock).toHaveBeenCalledWith(expect.stringContaining("forceReauth=true"), "_blank");
  });

  it("keeps the normal connected settings state unchanged", async () => {
    await render(<OneDriveConnectionSettings />);

    expect(host.textContent).toContain("saved@example.test");
    expect(host.textContent).toContain(translations.en.settings.oneDriveSwitchAccount);
    expect(host.textContent).not.toContain(translations.en.settings.oneDriveReconnectRequired);
  });

  it("shows reconnect guidance when organization shares require authorization again", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input) === "/api/onedrive/organization-shares") {
        return fetchResponse({ code: "ONEDRIVE_RECONNECT_REQUIRED" }, 409);
      }
      if (String(input) === "/api/onedrive/connection") return fetchResponse({ connected: true });
      return fetchResponse({}, 404);
    });

    await render(<OneDrivePage />);

    expect(host.textContent).toContain(translations.en.settings.oneDriveBrowse.reconnectRequired);
    expect(host.textContent).toContain(translations.en.settings.oneDriveBrowse.reconnect);
    expect(host.textContent).not.toContain(translations.en.settings.oneDriveBrowse.loadSharesError);

    await clickButton(translations.en.settings.oneDriveBrowse.reconnect);
    expect(openMock).toHaveBeenCalledWith(expect.stringContaining("forceReauth=true"), "_blank");
    expect(oneDriveApi.listOneDriveSharedWithMe).not.toHaveBeenCalled();
  });

  it("continues to show the normal no-folder state", async () => {
    await render(<OneDrivePage />);

    expect(host.textContent).toContain(translations.en.settings.oneDriveBrowse.noFoldersTitle);
    expect(host.textContent).not.toContain(translations.en.settings.oneDriveBrowse.reconnectRequired);
    expect(host.textContent).not.toContain(translations.en.settings.oneDriveBrowse.loadSharesError);
  });
});
