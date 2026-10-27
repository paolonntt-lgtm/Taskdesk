import { describe, expect, it } from "vitest";
import { getFolderLoadError } from "./oneDriveBrowseErrors";

const messages = {
  loadFolderError: "generic",
  reconnectFolderError: "reconnect",
  accessFolderError: "access",
  missingFolderError: "missing",
  setupFolderError: "setup",
};

describe("OneDrive folder errors", () => {
  it.each([
    [401, "reconnect"],
    [403, "access"],
    [404, "missing"],
    [503, "setup"],
    [502, "generic"],
  ])("maps HTTP %i to an actionable message", (status, expected) => {
    expect(getFolderLoadError({ status }, messages)).toBe(expected);
  });

  it("uses the generic message for errors without an HTTP status", () => {
    expect(getFolderLoadError(new Error("network failure"), messages)).toBe("generic");
  });
});
