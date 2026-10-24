// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ClientsScreen from "../app/clients";
import ClientDetailScreen from "../app/clients/[id]";

const mocks = vi.hoisted(() => ({
  settings: { clientsEnabled: false },
  settingsError: false,
  clients: [{ id: 1, name: "Studio Alfa", email: "info@studioalfa.it" }],
  client: { id: 1, name: "Studio Alfa", email: "info@studioalfa.it" },
  routeParams: { id: "1" },
  apiGet: vi.fn(),
  useQuery: vi.fn(),
  refetchSettings: vi.fn(),
}));

vi.mock("react-native", async () => {
  const ReactModule = await import("react");
  const element = ReactModule.createElement;
  const component = (tag: string) =>
    (props: Record<string, any>) => {
      const {
        testID,
        accessibilityRole,
        onPress,
        onChangeText,
        style: _style,
        ...rest
      } = props;
      return element(tag, {
        ...rest,
        ...(testID ? { "data-testid": testID } : {}),
        ...(accessibilityRole ? { role: accessibilityRole } : {}),
        ...(onPress ? { onClick: onPress } : {}),
        ...(onChangeText
          ? { onChange: (event: React.ChangeEvent<HTMLInputElement>) => onChangeText(event.target.value) }
          : {}),
      }, props.children);
    };
  return {
    ActivityIndicator: () => null,
    Alert: { alert: vi.fn() },
    Modal: component("div"),
    Pressable: component("button"),
    ScrollView: component("div"),
    StyleSheet: { create: (styles: unknown) => styles },
    Text: component("span"),
    TextInput: component("input"),
    View: component("div"),
  };
});

vi.mock("@expo/vector-icons", () => ({ Feather: () => null }));
vi.mock("expo-router", () => ({
  router: { push: vi.fn(), replace: vi.fn() },
  useLocalSearchParams: () => mocks.routeParams,
}));
vi.mock("@/hooks/useColors", () => ({
  useColors: () => new Proxy({}, { get: () => "#222222" }),
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { role: "admin", organizationId: 7 } }),
}));
vi.mock("@/contexts/LanguageContext", () => ({ useLanguage: () => ({ lang: "it" }) }));
vi.mock("@/utils/api", () => ({
  apiGet: mocks.apiGet,
  apiDelete: vi.fn(),
  apiPatch: vi.fn(),
  apiPost: vi.fn(),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: mocks.useQuery,
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

describe("mobile clients screen", () => {
  let host: HTMLDivElement;
  let root: Root;

  const renderScreen = async () => {
    await act(async () => root.render(React.createElement(ClientsScreen)));
  };

  const renderDetailScreen = async () => {
    await act(async () => root.render(React.createElement(ClientDetailScreen)));
  };

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    mocks.settings = { clientsEnabled: false };
    mocks.settingsError = false;
    mocks.refetchSettings.mockReset();
    mocks.client = { id: 1, name: "Studio Alfa", email: "info@studioalfa.it" };
    mocks.routeParams = { id: "1" };
    mocks.apiGet.mockReset().mockResolvedValue([]);
    mocks.useQuery.mockReset().mockImplementation((options: {
      queryKey: unknown[];
      queryFn: () => Promise<unknown>;
      enabled?: boolean;
    }) => {
      if (options.enabled) void options.queryFn();
      const key = options.queryKey[0];
      return {
        data: key === "mobile-organization-settings"
          ? mocks.settings
          : key === "mobile-client"
            ? mocks.client
            : mocks.clients,
        isSuccess: key === "mobile-organization-settings" && !mocks.settingsError,
        isError: key === "mobile-organization-settings" && mocks.settingsError,
        isLoading: false,
        error: null,
        refetch: key === "mobile-organization-settings" ? mocks.refetchSettings : vi.fn(),
      };
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it("shows the inactive-module message without requesting clients", async () => {
    await renderScreen();

    expect(host.textContent).toContain("La gestione clienti non è attiva");
    expect(mocks.apiGet.mock.calls.map(([path]) => path)).toEqual(["/settings/organization"]);

    const clientsQuery = mocks.useQuery.mock.calls
      .map(([options]) => options)
      .find(({ queryKey }: { queryKey: unknown[] }) => queryKey[0] === "mobile-clients");
    expect(clientsQuery?.enabled).toBe(false);
  });

  it("shows a distinct settings error and retry without requesting clients", async () => {
    mocks.settingsError = true;

    await renderScreen();

    expect(host.textContent).toContain("Impossibile verificare se la gestione clienti è attiva.");
    expect(host.textContent).toContain("Riprova");
    expect(host.textContent).not.toContain("La gestione clienti non è attiva");
    expect(mocks.apiGet.mock.calls.map(([path]) => path)).toEqual(["/settings/organization"]);

    const clientsQuery = mocks.useQuery.mock.calls
      .map(([options]) => options)
      .find(({ queryKey }: { queryKey: unknown[] }) => queryKey[0] === "mobile-clients");
    expect(clientsQuery?.enabled).toBe(false);

    const retryButton = Array.from(host.querySelectorAll("button"))
      .find(button => button.textContent?.includes("Riprova"));
    expect(retryButton).toBeDefined();
    await act(async () => retryButton?.click());
    expect(mocks.refetchSettings).toHaveBeenCalledTimes(1);
  });

  it("loads and displays clients when the module is enabled", async () => {
    mocks.settings = { clientsEnabled: true };

    await renderScreen();

    expect(mocks.apiGet.mock.calls.map(([path]) => path)).toEqual([
      "/settings/organization",
      "/clients",
    ]);
    expect(host.textContent).toContain("Studio Alfa");
    expect(host.textContent).not.toContain("La gestione clienti non è attiva");
  });

  it("shows the inactive-module message without requesting client details", async () => {
    await renderDetailScreen();

    expect(host.textContent).toContain("La gestione clienti non è attiva per questa organizzazione.");
    expect(mocks.apiGet.mock.calls.map(([path]) => path)).toEqual(["/settings/organization"]);

    const clientQuery = mocks.useQuery.mock.calls
      .map(([options]) => options)
      .find(({ queryKey }: { queryKey: unknown[] }) => queryKey[0] === "mobile-client");
    expect(clientQuery?.enabled).toBe(false);
  });

  it("loads and displays client details when the module is enabled", async () => {
    mocks.settings = { clientsEnabled: true };

    await renderDetailScreen();

    expect(mocks.apiGet.mock.calls.map(([path]) => path)).toEqual([
      "/settings/organization",
      "/clients/1",
    ]);
    expect(host.textContent).toContain("Studio Alfa");
  });
});
