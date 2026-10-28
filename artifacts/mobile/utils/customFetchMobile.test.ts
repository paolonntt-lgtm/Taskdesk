import { afterEach, describe, expect, it, vi } from "vitest";
import { customFetch, setBaseUrl } from "../../../lib/api-client-react/src/custom-fetch";

describe("mobile generated API requests", () => {
  afterEach(() => {
    setBaseUrl(null);
    vi.unstubAllGlobals();
  });

  it("uses the configured API origin and includes the session cookie", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("[]", { headers: { "Content-Type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    setBaseUrl("https://taskdesk.example");

    await customFetch("/api/clients/1/notes");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://taskdesk.example/api/clients/1/notes",
      expect.objectContaining({ credentials: "include", method: "GET" }),
    );
  });

  it("preserves an explicit credential policy", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("[]", { headers: { "Content-Type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    setBaseUrl("https://taskdesk.example");

    await customFetch("/api/clients/1/notes", { credentials: "omit" });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://taskdesk.example/api/clients/1/notes",
      expect.objectContaining({ credentials: "omit" }),
    );
  });
});
