// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { translations } from "../i18n/translations";
import NotificationsScreen from "../app/notifications";

const mocks = vi.hoisted(() => ({
  lang: "it" as "it" | "en",
  data: [] as Array<{
    id: number;
    notificationText: string;
    createdAt: string;
    isRead: boolean;
    ticketId?: number | null;
  }>,
  queryState: { isLoading: false, error: null as any },
  announceForAccessibility: vi.fn(),
  apiPatch: vi.fn(),
  invalidateQueries: vi.fn(),
  setQueryData: vi.fn(),
  push: vi.fn(),
}));

vi.mock("react-native", async () => {
  const ReactModule = await import("react");
  const nativeElement = (
    tag: string,
    props: Record<string, any>,
    children: React.ReactNode,
  ) => {
    const {
      accessibilityLabel,
      accessibilityRole,
      accessibilityLiveRegion,
      accessibilityHint,
      onPress,
      style,
      ...rest
    } = props;
    return ReactModule.createElement(tag, {
      ...rest,
      ...(accessibilityLabel ? { "aria-label": accessibilityLabel } : {}),
      ...(accessibilityRole ? { role: accessibilityRole } : {}),
      ...(accessibilityLiveRegion ? { "aria-live": accessibilityLiveRegion } : {}),
      ...(accessibilityHint ? { "aria-description": accessibilityHint } : {}),
      ...(onPress ? { onClick: onPress } : {}),
    }, children);
  };
  const component = (tag: string) => (props: Record<string, any>) =>
    nativeElement(tag, props, props.children);

  return {
    AccessibilityInfo: {
      announceForAccessibility: mocks.announceForAccessibility,
    },
    ActivityIndicator: () => null,
    Pressable: component("button"),
    ScrollView: component("div"),
    StyleSheet: { create: (styles: unknown) => styles },
    Text: component("span"),
    View: component("div"),
  };
});

vi.mock("@expo/vector-icons", () => ({ Feather: () => null }));
vi.mock("expo-router", () => ({ router: { push: mocks.push } }));
vi.mock("@/hooks/useColors", () => ({
  useColors: () => new Proxy({}, { get: () => "#222222" }),
}));
vi.mock("@/contexts/LanguageContext", async () => {
  const { translations: localizedStrings } = await import("../i18n/translations");
  return {
    useLanguage: () => ({
      lang: mocks.lang,
      t: localizedStrings[mocks.lang],
    }),
  };
});
vi.mock("@/utils/api", () => ({
  apiGet: vi.fn(),
  apiPatch: mocks.apiPatch,
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: mocks.data,
    isLoading: mocks.queryState.isLoading,
    error: mocks.queryState.error,
  }),
  useQueryClient: () => ({
    invalidateQueries: mocks.invalidateQueries,
    setQueryData: mocks.setQueryData,
  }),
}));

describe("mobile notification inbox accessibility", () => {
  let host: HTMLDivElement;
  let root: Root;

  const renderScreen = async () => {
    await act(async () => root.render(React.createElement(NotificationsScreen)));
  };

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    mocks.lang = "it";
    mocks.data = [];
    mocks.queryState = { isLoading: false, error: null };
    mocks.announceForAccessibility.mockReset();
    mocks.apiPatch.mockReset().mockResolvedValue({});
    mocks.invalidateQueries.mockReset().mockResolvedValue(undefined);
    mocks.setQueryData.mockReset().mockImplementation((_key, update) => {
      if (typeof update === "function") mocks.data = update(mocks.data);
      return mocks.data;
    });
    mocks.push.mockReset();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it.each(["it", "en"] as const)(
    "announces loading, empty, and error states in %s",
    async (language) => {
      mocks.lang = language;
      const strings = translations[language].notifications;

      mocks.queryState = { isLoading: true, error: null };
      await renderScreen();
      expect(host.textContent).toContain(strings.loading);
      expect(host.querySelector('[role="progressbar"]')?.getAttribute("aria-live")).toBe("polite");
      expect(mocks.announceForAccessibility).toHaveBeenLastCalledWith(strings.loading);

      mocks.announceForAccessibility.mockClear();
      mocks.queryState = { isLoading: false, error: null };
      await renderScreen();
      expect(host.textContent).toContain(strings.empty);
      expect(host.querySelector('[role="text"]')?.getAttribute("aria-live")).toBe("polite");
      expect(mocks.announceForAccessibility).toHaveBeenLastCalledWith(strings.empty);

      mocks.announceForAccessibility.mockClear();
      mocks.queryState = { isLoading: false, error: new Error("request failed") };
      await renderScreen();
      expect(host.textContent).toContain(strings.loadError);
      expect(host.querySelector('[role="alert"]')?.getAttribute("aria-live")).toBe("assertive");
      expect(mocks.announceForAccessibility).toHaveBeenLastCalledWith(strings.loadError);
      expect(host.textContent).not.toContain(strings.empty);
    },
  );

  it.each(["it", "en"] as const)(
    "announces when an unread notification is marked read in %s",
    async (language) => {
      mocks.lang = language;
      const strings = translations[language].notifications;
      mocks.data = [{
        id: 41,
        notificationText: "Ticket updated",
        createdAt: "2026-10-25T09:30:00.000Z",
        isRead: false,
        ticketId: 12,
      }];

      await renderScreen();
      const notification = host.querySelector('[role="button"]');
      expect(notification?.getAttribute("aria-label")).toBe(
        `Ticket updated. ${strings.itemUnread}`,
      );
      expect(notification?.getAttribute("aria-description")).toBe(strings.openUnreadNotification);

      await act(async () => notification?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
      expect(mocks.apiPatch).toHaveBeenCalledWith("/notifications/41/read", {});
      expect(mocks.announceForAccessibility).toHaveBeenCalledWith(strings.markedRead);
      expect(mocks.push).toHaveBeenCalledWith("/ticket/12");

      await renderScreen();
      expect(host.querySelector('[role="button"]')?.getAttribute("aria-label")).toBe(
        `Ticket updated. ${strings.itemRead}`,
      );
      expect(host.querySelector('[role="button"]')?.getAttribute("aria-description")).toBe(
        strings.openNotification,
      );
    },
  );
});
