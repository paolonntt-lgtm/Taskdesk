import { describe, expect, it } from "vitest";
import { dashboardPreferenceStorageKey } from "./dashboardPreferenceStorage";

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
});
