import { describe, expect, it } from "vitest";
import {
  getCreatedTicketDetailHref,
  getTicketDetailBackHref,
} from "./ticketCreationNavigation";

describe("new ticket navigation", () => {
  it("opens a newly created ticket with the ticket list as its back destination", () => {
    expect(getCreatedTicketDetailHref(42)).toBe("/ticket/42?returnTo=tickets");
    expect(getTicketDetailBackHref("tickets")).toBe("/(tabs)/tickets");
  });

  it("handles array-valued route params", () => {
    expect(getTicketDetailBackHref(["tickets"])).toBe("/(tabs)/tickets");
  });

  it("preserves normal back navigation for tickets opened elsewhere", () => {
    expect(getTicketDetailBackHref(undefined)).toBeNull();
    expect(getTicketDetailBackHref("dashboard")).toBeNull();
  });
});
