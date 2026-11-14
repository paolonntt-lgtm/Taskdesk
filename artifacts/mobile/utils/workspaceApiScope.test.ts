import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  hashWorkspaceQueryKey,
  installWorkspaceFetchInterceptor,
  setActiveWorkspaceContext,
} from "./api";

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));

describe("mobile workspace API scope", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let removeInterceptor: (() => void) | undefined;

  beforeEach(() => {
    fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    removeInterceptor = installWorkspaceFetchInterceptor();
  });

  afterEach(() => {
    setActiveWorkspaceContext(null, null);
    removeInterceptor?.();
    removeInterceptor = undefined;
    vi.unstubAllGlobals();
  });

  it("adds the selected workspace header only to app API requests", async () => {
    setActiveWorkspaceContext(22, 7);
    await fetch("/api/tickets");
    await fetch("https://uploads.example/file", { method: "PUT" });

    const apiHeaders = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(apiHeaders.get("X-Workspace-ID")).toBe("22");
    expect(new Headers(fetchMock.mock.calls[1]?.[1]?.headers).has("X-Workspace-ID")).toBe(false);
  });

  it("leaves the home organization headerless and isolates query identities by workspace", async () => {
    setActiveWorkspaceContext(7, 7);
    await fetch("/api/auth/me");
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).has("X-Workspace-ID")).toBe(false);

    expect(hashWorkspaceQueryKey(["tickets"], 7)).not.toBe(hashWorkspaceQueryKey(["tickets"], 22));
    expect(hashWorkspaceQueryKey(["tickets", "workspace", 22], 22))
      .toBe(hashWorkspaceQueryKey(["tickets"], 22));
  });
});
