// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  appStateListener: undefined as ((state: string) => void) | undefined,
  getPermissionsAsync: vi.fn(),
  requestPermissionsAsync: vi.fn(),
  getExpoPushTokenAsync: vi.fn(),
  apiFetch: vi.fn(),
  removeListener: vi.fn(),
}));

vi.mock("react-native", () => ({
  AppState: {
    currentState: "active",
    addEventListener: (_event: string, listener: (state: string) => void) => {
      mocks.appStateListener = listener;
      return { remove: mocks.removeListener };
    },
  },
  Platform: { OS: "android" },
}));

vi.mock("expo-constants", () => ({
  default: {
    appOwnership: "standalone",
    expoConfig: { extra: { eas: { projectId: "taskdesk-test-project" } } },
    easConfig: null,
  },
}));

vi.mock("expo-notifications", () => ({
  AndroidImportance: { MAX: 5 },
  setNotificationChannelAsync: vi.fn().mockResolvedValue(undefined),
  getPermissionsAsync: mocks.getPermissionsAsync,
  requestPermissionsAsync: mocks.requestPermissionsAsync,
  getExpoPushTokenAsync: mocks.getExpoPushTokenAsync,
  setNotificationHandler: vi.fn(),
  addNotificationResponseReceivedListener: vi.fn(() => ({ remove: mocks.removeListener })),
  getLastNotificationResponseAsync: vi.fn().mockResolvedValue(null),
  clearLastNotificationResponseAsync: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/utils/api", () => ({ apiFetch: mocks.apiFetch }));

import { usePushNotifications } from "../hooks/usePushNotifications";

function Harness() {
  usePushNotifications(true);
  return null;
}

describe("Android push token registration", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    mocks.appStateListener = undefined;
    mocks.getPermissionsAsync.mockReset()
      .mockResolvedValueOnce({ status: "denied" })
      .mockResolvedValueOnce({ status: "granted" });
    mocks.requestPermissionsAsync.mockReset().mockResolvedValue({ status: "denied" });
    mocks.getExpoPushTokenAsync.mockReset().mockResolvedValue({ data: "ExponentPushToken[test]" });
    mocks.apiFetch.mockReset().mockResolvedValue({ ok: true, status: 200 });
    mocks.removeListener.mockReset();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it("registers the token after notification permission is enabled in Android settings", async () => {
    await act(async () => {
      root.render(React.createElement(Harness));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mocks.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(mocks.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(mocks.appStateListener).toBeTypeOf("function");

    await act(async () => {
      mocks.appStateListener?.("background");
      mocks.appStateListener?.("active");
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mocks.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(mocks.getExpoPushTokenAsync).toHaveBeenCalledTimes(1);
    expect(mocks.apiFetch).toHaveBeenCalledWith("/notifications/push-token", {
      method: "POST",
      body: JSON.stringify({ token: "ExponentPushToken[test]" }),
    });
  });
});
