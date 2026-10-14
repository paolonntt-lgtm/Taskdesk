import { describe, expect, it } from "vitest";
import { compactEmailDetailLinks, splitEmailBodySections } from "./emailDisplay";

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

  it("uses the first closing line so an older reply does not become the main message", () => {
    const body = [
      "Buon pomeriggio Paolo",
      "",
      "perfetto, ti confermo per domani 11.30. Saluti cordiali",
      "",
      "*Tiziana Pietrolungo *",
      "",
      "*Consulente del Lavoro *",
      "",
      "Cell +39 3474726242",
      "",
      "--",
      "Footer dello studio e vecchie email",
      "A presto,",
      "Paolo",
      "Il 2026-10-13 Tiziana ha scritto:",
      "Messaggio originale citato",
    ].join("\n");

    const sections = splitEmailBodySections(body);

    expect(sections.message).toBe(
      "Buon pomeriggio Paolo\n\nperfetto, ti confermo per domani 11.30. Saluti cordiali",
    );
    expect(sections.details).toContain("*Tiziana Pietrolungo *");
    expect(sections.details).toContain("Messaggio originale citato");
  });
});
