import { describe, expect, it } from "vitest";
import { formatTicketDeadlineParts } from "./ticketDeadline";
import { translations } from "../i18n/translations";

const now = new Date("2026-11-14T12:00:00.000Z");

describe("mobile ticket deadline display", () => {
  it("formats past deadlines in Italian and English", () => {
    const dueAt = "2026-11-13T15:26:00.000Z";
    const italian = formatTicketDeadlineParts(dueAt, "it", now);
    const english = formatTicketDeadlineParts(dueAt, "en", now);

    expect(italian?.expired).toBe(true);
    expect(italian?.time).toMatch(/^\d{2}\.\d{2}$/);
    expect(translations.it.ticketDetail.dueAtExpired(italian!.date, italian!.time))
      .toMatch(/^Scaduto il 13 novembre alle \d{2}\.\d{2}$/);
    expect(english?.expired).toBe(true);
    expect(translations.en.ticketDetail.dueAtExpired(english!.date, english!.time))
      .toMatch(/^Expired on November 13 at .+$/);
  });

  it("formats future deadlines as upcoming and leaves missing dates absent", () => {
    const future = formatTicketDeadlineParts("2026-11-15T15:26:00.000Z", "it", now);
    expect(future?.expired).toBe(false);
    expect(translations.it.ticketDetail.dueAtUpcoming(future!.date, future!.time))
      .toMatch(/^In scadenza il 15 novembre alle \d{2}\.\d{2}$/);
    expect(formatTicketDeadlineParts(null, "it", now)).toBeNull();
  });
});
