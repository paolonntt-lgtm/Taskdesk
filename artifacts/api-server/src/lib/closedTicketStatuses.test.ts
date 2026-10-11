import { describe, expect, it } from "vitest";
import { getClosedTicketStatusKeys } from "./closedTicketStatuses";

describe("getClosedTicketStatusKeys", () => {
  it("uses the organization's configured closed statuses", () => {
    expect(getClosedTicketStatusKeys([
      { key: "new", isClosed: false },
      { key: "in_progress", isClosed: false },
      { key: "completed", isClosed: true },
    ])).toEqual(["completed", "resolved", "closed"]);
  });

  it("respects explicit open configuration for legacy closed keys", () => {
    expect(getClosedTicketStatusKeys([
      { key: "open", isClosed: false },
      { key: "resolved", isClosed: false },
      { key: "closed", isClosed: true },
    ])).toEqual(["closed"]);
  });

  it("falls back to legacy closed keys when no statuses are configured", () => {
    expect(getClosedTicketStatusKeys([])).toEqual(["resolved", "closed"]);
  });

  it("does not duplicate a configured closed legacy status", () => {
    expect(getClosedTicketStatusKeys([
      { key: "resolved", isClosed: true },
      { key: "closed", isClosed: true },
    ])).toEqual(["resolved", "closed"]);
  });
});
