// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TimeReportScreen from "../app/time-report";
import { getRecentMonthOptions } from "./timeReportMonths";

const mocks = vi.hoisted(() => ({
  settings: { timeTrackingModuleEnabled: false },
  settingsError: false,
  settingsRefetchError: false,
  refetchSettings: vi.fn(),
  apiGet: vi.fn(),
  useQuery: vi.fn(),
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
    ScrollView: component("div"),
    StyleSheet: { create: (styles: unknown) => styles },
    Text: component("span"),
    TextInput: component("input"),
    TouchableOpacity: component("button"),
    View: component("div"),
  };
});

vi.mock("@expo/vector-icons", () => ({ Feather: () => null }));
vi.mock("expo-router", () => ({ router: { back: vi.fn(), push: vi.fn() } }));
vi.mock("@/hooks/useColors", () => ({
  useColors: () => new Proxy({}, { get: () => "#222222" }),
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { role: "admin", organizationId: 7 } }),
}));
vi.mock("@/contexts/LanguageContext", () => ({ useLanguage: () => ({ lang: "it" }) }));
vi.mock("@/utils/api", () => ({ apiGet: mocks.apiGet }));
vi.mock("@tanstack/react-query", () => ({ useQuery: mocks.useQuery }));

describe("mobile hours report screen", () => {
  let host: HTMLDivElement;
  let root: Root;

  const renderScreen = async () => {
    await act(async () => root.render(React.createElement(TimeReportScreen)));
  };

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    mocks.settings = { timeTrackingModuleEnabled: false };
    mocks.settingsError = false;
    mocks.settingsRefetchError = false;
    mocks.refetchSettings.mockReset();
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
          : key === "mobile-time-report"
            ? {
                customerRows: [],
                collaboratorRows: [],
                totals: {
                  clientBillableMinutes: 0,
                  clientUnbilledMinutes: 0,
                  clientBilledMinutes: 0,
                  collaboratorRecognizableMinutes: 0,
                },
              }
            : [],
        isSuccess: key === "mobile-organization-settings" && !mocks.settingsError,
        isRefetchError: key === "mobile-organization-settings" && mocks.settingsRefetchError,
        isError: key === "mobile-organization-settings" && mocks.settingsError,
        isLoading: false,
        refetch: key === "mobile-organization-settings" ? mocks.refetchSettings : vi.fn(),
      };
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it("shows the inactive-module message without requesting report, clients, or collaborators", async () => {
    await renderScreen();

    expect(host.textContent).toContain("Il modulo di tracciamento ore è disattivato");
    expect(mocks.apiGet.mock.calls.map(([path]) => path)).toEqual(["/settings/organization"]);

    const queryOptions = mocks.useQuery.mock.calls.map(([options]) => options);
    expect(queryOptions.filter(({ queryKey }: { queryKey: unknown[] }) =>
      ["mobile-time-report", "mobile-time-report-clients", "mobile-time-report-users"].includes(String(queryKey[0])),
    ).map(({ enabled }: { enabled?: boolean }) => enabled)).toEqual([false, false, false]);
  });

  it("requests report, clients, and collaborators when TaskTrack is enabled", async () => {
    mocks.settings = { timeTrackingModuleEnabled: true };

    await renderScreen();

    expect(mocks.apiGet.mock.calls.map(([path]) => path)).toEqual([
      "/settings/organization",
      "/time-tracking/report",
      "/clients",
      "/users",
    ]);
    expect(host.textContent).not.toContain("Il modulo di tracciamento ore è disattivato");
  });

  it("does not expose cached TaskTrack data after the settings refresh fails", async () => {
    mocks.settings = { timeTrackingModuleEnabled: true };
    mocks.settingsRefetchError = true;

    await renderScreen();

    expect(host.textContent).toContain("Impossibile verificare se TaskTrack è attivo");
    expect(host.textContent).not.toContain("Il modulo di tracciamento ore è disattivato");
    expect(host.querySelector('[data-testid="filter-time-report-month"]')).toBeNull();
    expect(mocks.apiGet.mock.calls.map(([path]) => path)).toEqual(["/settings/organization"]);
    const reportQueries = mocks.useQuery.mock.calls
      .map(([options]) => options)
      .filter(({ queryKey }: { queryKey: unknown[] }) =>
        ["mobile-time-report", "mobile-time-report-clients", "mobile-time-report-users"].includes(String(queryKey[0])),
      );
    expect(reportQueries.map(({ enabled }: { enabled?: boolean }) => enabled)).toEqual([false, false, false]);

    const retry = host.querySelector<HTMLButtonElement>('[data-testid="retry-time-report-settings"]');
    expect(retry).not.toBeNull();
    await act(async () => retry!.click());
    expect(mocks.refetchSettings).toHaveBeenCalledTimes(1);
  });

  it("loads the selected month without requiring manual date entry", async () => {
    mocks.settings = { timeTrackingModuleEnabled: true };
    await renderScreen();

    const monthFilter = host.querySelector('[data-testid="filter-time-report-month"]') as HTMLButtonElement;
    await act(async () => monthFilter.click());

    const currentMonth = getRecentMonthOptions(12, new Date(), "it-IT")[0];
    const monthOption = host.querySelector(`[data-testid="time-report-month-${currentMonth.value}"]`) as HTMLButtonElement;
    await act(async () => monthOption.click());

    const reportPaths = mocks.apiGet.mock.calls
      .map(([path]) => path as string)
      .filter((path) => path.startsWith("/time-tracking/report"));
    expect(reportPaths.at(-1)).toBe(
      `/time-tracking/report?dateFrom=${currentMonth.dateFrom}&dateTo=${currentMonth.dateTo}`,
    );
    expect((host.querySelector('[data-testid="input-time-report-date-from"]') as HTMLInputElement).value).toBe(currentMonth.dateFrom);
    expect((host.querySelector('[data-testid="input-time-report-date-to"]') as HTMLInputElement).value).toBe(currentMonth.dateTo);
  });
});
