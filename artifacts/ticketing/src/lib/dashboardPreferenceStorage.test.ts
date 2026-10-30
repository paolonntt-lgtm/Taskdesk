import { afterEach, describe, expect, it, vi } from "vitest";
import {
  dashboardPreferenceStorageKey,
  dashboardWidgetInstancePreferenceKey,
  dashboardWidgetSettingsId,
  getPersonWidgetTicketsQuery,
  readDashboardWidgetInstancePreference,
  writeDashboardWidgetInstancePreference,
} from "./dashboardPreferenceStorage";

function createMemoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("dashboardPreferenceStorageKey", () => {
  it("keeps the same dashboard preference separate for each user", () => {
    const firstUserKey = dashboardPreferenceStorageKey("td_dashboard_layout_v4", 12);
    const secondUserKey = dashboardPreferenceStorageKey("td_dashboard_layout_v4", 34);

    expect(firstUserKey).not.toBe(secondUserKey);
    expect(firstUserKey).toBe("td_dashboard_layout_v4:user:12");
    expect(secondUserKey).toBe("td_dashboard_layout_v4:user:34");
  });

  it("does not mix anonymous preferences with an authenticated user", () => {
    expect(dashboardPreferenceStorageKey("td_dashboard_layout_v4", null))
      .toBe("td_dashboard_layout_v4:anonymous");
    expect(dashboardPreferenceStorageKey("td_dashboard_layout_v4", 12))
      .not.toBe(dashboardPreferenceStorageKey("td_dashboard_layout_v4", null));
  });

  it("keeps settings for duplicate widget instances separate", () => {
    const firstInstance = dashboardWidgetInstancePreferenceKey("td_widget_person_id", "feed-person");
    const secondInstance = dashboardWidgetInstancePreferenceKey("td_widget_person_id", "feed-person__123");

    expect(firstInstance).not.toBe(secondInstance);
  });
});

describe("collaborator ticket widgets", () => {
  it("restores each instance and loads that collaborator's tickets after a refresh", async () => {
    const storage = createMemoryStorage();
    const widgetId = "feed-person";
    const duplicateWidgetId = "feed-person__123";
    const preferenceKey = "td_widget_person_id:user:12";

    // Configure two widgets, then read from storage again as a page reload would.
    writeDashboardWidgetInstancePreference(storage, preferenceKey, widgetId, "11", widgetId);
    writeDashboardWidgetInstancePreference(storage, preferenceKey, duplicateWidgetId, "22", widgetId);
    const firstSelectedId = Number(readDashboardWidgetInstancePreference(storage, preferenceKey, widgetId, widgetId));
    const secondSelectedId = Number(readDashboardWidgetInstancePreference(storage, preferenceKey, duplicateWidgetId, widgetId));
    const users = [
      { id: 11, name: "Ada" },
      { id: 22, name: "Lin" },
    ];

    expect([firstSelectedId, secondSelectedId]).toEqual([11, 22]);
    expect(users.find((user) => user.id === firstSelectedId)?.name).toBe("Ada");
    expect(users.find((user) => user.id === secondSelectedId)?.name).toBe("Lin");

    const ticketsByUrl: Record<string, { id: number; title: string }[]> = {
      "/api/tickets?assignedTo=11&status=open": [{ id: 101, title: "Ada's ticket" }],
      "/api/tickets?assignedTo=22&status=open": [{ id: 202, title: "Lin's ticket" }],
    };
    const fetchMock = vi.fn(async (url: string) => ({
      json: async () => ticketsByUrl[url] ?? [],
    }));
    vi.stubGlobal("fetch", fetchMock);

    const firstQuery = getPersonWidgetTicketsQuery(firstSelectedId);
    const secondQuery = getPersonWidgetTicketsQuery(secondSelectedId);
    const [firstTickets, secondTickets] = await Promise.all([
      firstQuery.queryFn(),
      secondQuery.queryFn(),
    ]);

    expect(firstQuery.queryKey).not.toEqual(secondQuery.queryKey);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/tickets?assignedTo=11&status=open",
      { credentials: "include" },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/tickets?assignedTo=22&status=open",
      { credentials: "include" },
    );
    expect(firstTickets).toEqual([{ id: 101, title: "Ada's ticket" }]);
    expect(secondTickets).toEqual([{ id: 202, title: "Lin's ticket" }]);
  });

  it("restores the legacy single-widget preference only for the original instance", () => {
    const storage = createMemoryStorage();
    const legacyKey = "td_widget_person_id:user:12";
    storage.setItem(legacyKey, "31");

    expect(readDashboardWidgetInstancePreference(storage, legacyKey, "feed-person", "feed-person"))
      .toBe("31");
    expect(readDashboardWidgetInstancePreference(storage, legacyKey, "feed-person__123", "feed-person"))
      .toBeNull();
  });
});

describe("dashboardWidgetSettingsId", () => {
  it("uses the instance ID for duplicate widget settings", () => {
    expect(dashboardWidgetSettingsId("feed-person", "feed-person__123"))
      .toBe("feed-person__123");
  });

  it("keeps the base ID for the original widget and existing callers", () => {
    expect(dashboardWidgetSettingsId("feed-person", "feed-person"))
      .toBe("feed-person");
    expect(dashboardWidgetSettingsId("feed-person", ""))
      .toBe("feed-person");
  });

  it("does not mistake an unrelated widget ID for an instance", () => {
    expect(dashboardWidgetSettingsId("feed-person", "feed-group__123"))
      .toBe("feed-person");
  });
});
