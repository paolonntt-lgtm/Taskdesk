import { describe, expect, it } from "vitest";
import { compactEmailDetailLinks } from "./emailDisplay";

describe("compactEmailDetailLinks", () => {
  it("shows long Google Maps URLs as short clickable labels", () => {
    const url = "https://www.google.com/maps/search/ROMA+-+VIA+MACHIAVELLI?entry=gmail&source=g";
    const result = compactEmailDetailLinks(`<${url}>\n${url}`);

    expect(result).toBe(`[mappa](${url})\n[mappa](${url})`);
    expect(result.match(/\[mappa\]/g)).toHaveLength(2);
  });

  it("preserves existing Markdown links", () => {
    const input = "[ROMA](https://www.google.com/maps/search/ROMA)";
    expect(compactEmailDetailLinks(input)).toBe(input);
  });
});
