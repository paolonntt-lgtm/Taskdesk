import { describe, expect, it } from "vitest";
import { getInboundEmailNotificationTarget } from "./inboundEmailNotificationPolicy";

describe("getInboundEmailNotificationTarget", () => {
  it("targets only the assigned operator", () => {
    expect(getInboundEmailNotificationTarget(42)).toEqual({
      kind: "assignee",
      userId: 42,
    });
  });

  it("keeps subscriber notifications when no operator is assigned", () => {
    expect(getInboundEmailNotificationTarget(null)).toEqual({
      kind: "subscribers",
    });
  });
});
