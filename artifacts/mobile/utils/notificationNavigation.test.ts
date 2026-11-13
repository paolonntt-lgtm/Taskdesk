import { describe, expect, it } from "vitest";
import {
  getNotificationResponseKey,
  getTicketIdFromNotificationResponse,
} from "./notificationNavigation";

describe("push notification navigation", () => {
  it.each([73, "73"])("reads a valid ticket ID from response data: %s", (ticketId) => {
    expect(getTicketIdFromNotificationResponse({
      notification: {
        request: {
          content: { data: { ticketId } },
        },
      },
    })).toBe(73);
  });

  it.each([0, -3, 1.5, "0", "-3", "ticket-73", null, undefined])(
    "ignores invalid ticket IDs: %s",
    (ticketId) => {
      expect(getTicketIdFromNotificationResponse({
        notification: {
          request: {
            content: { data: { ticketId } },
          },
        },
      })).toBeNull();
    },
  );

  it("ignores notifications without ticket data", () => {
    expect(getTicketIdFromNotificationResponse({ notification: { request: { content: { data: {} } } } }))
      .toBeNull();
    expect(getTicketIdFromNotificationResponse(null)).toBeNull();
  });

  it("creates a stable key to avoid handling the launch response twice", () => {
    const response = {
      actionIdentifier: "open",
      notification: { request: { identifier: "push-73" } },
    };
    expect(getNotificationResponseKey(response)).toBe("push-73:open");
    expect(getNotificationResponseKey({})).toBeNull();
  });
});
