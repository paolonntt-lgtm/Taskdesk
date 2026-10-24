import type { Request, Response } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { requireSameOrigin } from "./originCheck";

function invoke(origin?: string) {
  const req = {
    headers: origin ? { origin } : {},
    method: "POST",
    url: "/auth/login",
  } as Request;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as unknown as Response;
  const next = vi.fn();

  requireSameOrigin(req, res, next);
  return { res, next };
}

describe("requireSameOrigin", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows the exact Expo preview origin for mobile web login", () => {
    vi.stubEnv("REPLIT_EXPO_DEV_DOMAIN", "current.expo.picard.replit.dev");
    vi.stubEnv("REPLIT_DEV_DOMAIN", "");
    vi.stubEnv("REPLIT_DOMAINS", "");

    const { next, res } = invoke("https://current.expo.picard.replit.dev");

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("still rejects a different Replit Expo preview origin", () => {
    vi.stubEnv("REPLIT_EXPO_DEV_DOMAIN", "current.expo.picard.replit.dev");
    vi.stubEnv("REPLIT_DEV_DOMAIN", "");
    vi.stubEnv("REPLIT_DOMAINS", "");

    const { next, res } = invoke("https://another.expo.picard.replit.dev");

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: "Forbidden",
      message: "Cross-origin request rejected",
    });
  });

  it("continues to allow requests without an Origin header", () => {
    vi.stubEnv("REPLIT_EXPO_DEV_DOMAIN", "");

    const { next, res } = invoke();

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });
});
