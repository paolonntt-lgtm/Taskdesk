import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPermissionsAsync: vi.fn(),
  requestPermissionsAsync: vi.fn(),
  getExpoPushTokenAsync: vi.fn(),
  setNotificationChannelAsync: vi.fn(),
}));

vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
vi.mock("expo-constants", () => ({
  default: {
    appOwnership: "standalone",
    expoConfig: { extra: { eas: { projectId: "taskdesk-test-project" } } },
    easConfig: null,
  },
}));
vi.mock("@/utils/api", () => ({ apiFetch: vi.fn() }));

import { registerForPushNotifications } from "../hooks/usePushNotifications";

describe("Android push registration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.setNotificationChannelAsync.mockResolvedValue(undefined);
    mocks.getPermissionsAsync.mockResolvedValue({ status: "granted" });
    mocks.requestPermissionsAsync.mockResolvedValue({ status: "granted" });
    mocks.getExpoPushTokenAsync.mockResolvedValue({ data: "ExponentPushToken[test]" });
  });

  it("registers a token on resume without prompting again after Android permission is granted", async () => {
    const token = await registerForPushNotifications({
      AndroidImportance: { MAX: 5 },
      setNotificationChannelAsync: mocks.setNotificationChannelAsync,
      getPermissionsAsync: mocks.getPermissionsAsync,
      requestPermissionsAsync: mocks.requestPermissionsAsync,
      getExpoPushTokenAsync: mocks.getExpoPushTokenAsync,
    } as unknown as typeof import("expo-notifications"), false);

    expect(token).toBe("ExponentPushToken[test]");
    expect(mocks.getPermissionsAsync).toHaveBeenCalledOnce();
    expect(mocks.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(mocks.getExpoPushTokenAsync).toHaveBeenCalledWith({
      projectId: "taskdesk-test-project",
    });
  });
});
