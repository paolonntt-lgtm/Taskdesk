import { describe, expect, it } from "vitest";
import { translations } from "./translations";

describe("recurrence stop translations", () => {
  it("explains in Italian and English that future occurrences stop without changing existing tickets", () => {
    expect(translations.it.ticketDetail.recurrenceStop).toBe("Interrompi future occorrenze");
    expect(translations.it.ticketDetail.recurrenceStopInfo).toContain("I ticket già creati");
    expect(translations.it.ticketDetail.recurrenceStopped).toContain("non sono stati modificati");

    expect(translations.en.ticketDetail.recurrenceStop).toBe("Stop future occurrences");
    expect(translations.en.ticketDetail.recurrenceStopInfo).toContain("Tickets already created");
    expect(translations.en.ticketDetail.recurrenceStopped).toContain("were not changed");
  });
});
