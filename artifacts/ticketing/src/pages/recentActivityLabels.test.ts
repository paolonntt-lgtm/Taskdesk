import { describe, expect, it } from "vitest";
import { translations } from "../i18n/translations";
import { formatRecentActivitySummary } from "./recentActivityLabels";

describe("recent activity dashboard labels", () => {
  it("renders activity and author labels in Italian and English", () => {
    expect(formatRecentActivitySummary("status_changed", "Mario", translations.it))
      .toBe("Stato modificato · da Mario");
    expect(formatRecentActivitySummary("status_changed", "Mario", translations.en))
      .toBe("Status changed · by Mario");
  });

  it("uses the localized fallback when the activity author is unavailable", () => {
    expect(formatRecentActivitySummary("status_changed", null, translations.it))
      .toBe("Stato modificato · autore non disponibile");
    expect(formatRecentActivitySummary("status_changed", null, translations.en))
      .toBe("Status changed · author unavailable");
  });

  it("uses the localized generic label for an unknown activity type", () => {
    expect(formatRecentActivitySummary("unknown_action", "Mario", translations.it))
      .toBe("Pratica aggiornata · da Mario");
    expect(formatRecentActivitySummary("unknown_action", "Mario", translations.en))
      .toBe("Ticket updated · by Mario");
  });
});
