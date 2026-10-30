import { describe, expect, it } from "vitest";
import {
  dashboardPreferenceStorageKey,
  dashboardWidgetInstancePreferenceKey,
  dashboardWidgetSettingsId,
} from "./dashboardPreferenceStorage";

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
