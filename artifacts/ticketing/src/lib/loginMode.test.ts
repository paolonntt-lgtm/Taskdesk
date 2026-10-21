import { describe, expect, it } from "vitest";
import { getInitialLoginMode } from "./loginMode";

describe("getInitialLoginMode", () => {
  it("opens registration when the landing page explicitly requests it", () => {
    expect(getInitialLoginMode("?mode=register&trial_profession=notai")).toBe("register");
  });

  it("preserves registration for referral links", () => {
    expect(getInitialLoginMode("?ref=partner-code")).toBe("register");
  });

  it("defaults to login for ordinary app visits", () => {
    expect(getInitialLoginMode("?trial_profession=notai")).toBe("login");
  });
});
