// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import UsersScreen from "../app/users";
import { translations } from "../i18n/translations";

const mocks = vi.hoisted(() => ({
  users: [
    {
      id: 2,
      name: "Ada Lovelace",
      email: "ada@example.test",
      role: "user",
      avatarUrl: "data:image/jpeg;base64,photo",
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: 3,
      name: "Grace Hopper",
      email: "grace@example.test",
      role: "admin",
      avatarUrl: null,
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: 4,
      name: "Katherine Johnson",
      email: "katherine@example.test",
      role: "user",
      avatarUrl: null,
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  avatarQueries: [] as Array<{ userId: number; enabled: boolean; teamScopeId: number | null }>,
}));

vi.mock("react-native", async () => {
  const ReactModule = await import("react");
  const component = (tag: string) => (props: Record<string, any>) => {
    const {
      testID,
      onPress,
      activeOpacity: _activeOpacity,
      style: _style,
      ...rest
    } = props;
    return ReactModule.createElement(tag, {
      ...rest,
      ...(testID ? { "data-testid": testID } : {}),
      ...(onPress ? { onClick: onPress } : {}),
    }, props.children);
  };

  return {
    ActivityIndicator: () => null,
    Alert: { alert: vi.fn() },
    FlatList: ({
      data,
      renderItem,
      onViewableItemsChanged,
    }: {
      data: unknown[];
      renderItem: (args: { item: unknown }) => React.ReactNode;
      onViewableItemsChanged: (args: { viewableItems: Array<{ item: unknown; isViewable: boolean }> }) => void;
    }) => ReactModule.createElement(
      "div",
      { "data-testid": "team-list" },
      ...data.map((item, index) =>
        ReactModule.createElement(ReactModule.Fragment, { key: index }, renderItem({ item })),
      ),
      ReactModule.createElement(ViewabilityNotifier, { data, onViewableItemsChanged }),
    ),
    Image: ({
      source,
      ...props
    }: {
      source: { uri: string };
      [key: string]: unknown;
    }) => ReactModule.createElement("img", { src: source.uri, ...props }),
    KeyboardAvoidingView: component("div"),
    Modal: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
      visible ? ReactModule.createElement("div", null, children) : null,
    Platform: { OS: "ios" },
    ScrollView: component("div"),
    StyleSheet: { create: (styles: unknown) => styles },
    Switch: component("input"),
    Text: component("span"),
    TextInput: component("input"),
    TouchableOpacity: component("button"),
    View: component("div"),
  };

  function ViewabilityNotifier({
    data,
    onViewableItemsChanged,
  }: {
    data: unknown[];
    onViewableItemsChanged: (args: { viewableItems: Array<{ item: unknown; isViewable: boolean }> }) => void;
  }) {
    ReactModule.useEffect(() => {
      onViewableItemsChanged({
        viewableItems: data.slice(0, 2).map((item) => ({ item, isViewable: true })),
      });
    }, [data, onViewableItemsChanged]);
    return null;
  }
});

vi.mock("@expo/vector-icons", () => ({ Feather: () => null }));
vi.mock("expo-haptics", () => ({
  default: {
    impactAsync: vi.fn(),
    ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
    notificationAsync: vi.fn(),
    NotificationFeedbackType: { Success: "success" },
  },
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => ({
    data: queryKey[0] === "users"
      ? mocks.users
      : { timeTrackingModuleEnabled: false },
    isLoading: false,
    refetch: vi.fn(),
  }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("@workspace/api-client-react", () => ({
  useGetUserAvatar: (
    userId: number,
    options: { query: { enabled: boolean; queryKey: unknown[] } },
  ) => {
    mocks.avatarQueries.push({
      userId,
      enabled: options.query.enabled,
      teamScopeId: options.query.queryKey[1] as number | null,
    });
    return {
      data: userId === 3 ? { avatarUrl: "data:image/jpeg;base64,late-photo" } : { avatarUrl: null },
    };
  },
}));
vi.mock("@/hooks/useColors", () => ({
  useColors: () => new Proxy({}, { get: () => "#222222" }),
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: 1, role: "admin", organizationId: 7 } }),
}));
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ t: translations.it }),
}));
vi.mock("@/utils/api", () => ({
  LOCATIONS: [],
  apiDelete: vi.fn(),
  apiGet: vi.fn(() => Promise.resolve({ value: [] })),
  apiPatch: vi.fn(),
  apiPost: vi.fn(),
}));

describe("mobile team profile photos", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 375 });
    host = document.createElement("div");
    host.style.width = "375px";
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it("shows available photos and keeps initials when a photo is missing or fails", async () => {
    await act(async () => root.render(React.createElement(UsersScreen)));

    const photoAvatar = host.querySelector('[data-testid="user-avatar-2"]');
    const onDemandPhotoAvatar = host.querySelector('[data-testid="user-avatar-3"]');
    const missingPhotoAvatar = host.querySelector('[data-testid="user-avatar-4"]');
    expect(photoAvatar?.querySelector("img")?.getAttribute("src"))
      .toBe("data:image/jpeg;base64,photo");
    expect(photoAvatar?.textContent).toContain("AL");
    expect(onDemandPhotoAvatar?.querySelector("img")?.getAttribute("src"))
      .toBe("data:image/jpeg;base64,late-photo");
    expect(mocks.avatarQueries).toContainEqual({
      userId: 3,
      enabled: true,
      teamScopeId: 7,
    });
    expect(mocks.avatarQueries).toContainEqual({
      userId: 4,
      enabled: false,
      teamScopeId: 7,
    });
    expect(missingPhotoAvatar?.querySelector("img")).toBeNull();
    expect(missingPhotoAvatar?.textContent).toContain("KJ");

    await act(async () => {
      photoAvatar?.querySelector("img")?.dispatchEvent(new Event("error"));
    });
    expect(photoAvatar?.querySelector("img")).toBeNull();
    expect(photoAvatar?.textContent).toContain("AL");
  });
});
