import { describe, expect, it } from "vitest";
import {
  compactEmailDetailLinks,
  splitEmailBodySections,
  splitEmailThreadDetails,
} from "./emailDisplay";

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

  it("keeps the signature visible separately and splits quoted email bodies", () => {
    const details = [
      "*Tiziana Pietrolungo *",
      "*Consulente del Lavoro *",
      "Cell +39 3474726242",
      "--",
      "Consulenti del Lavoro Associati",
      "Privacy e footer dello studio",
      "*Da: paolo@taskdesk.it Inviato: martedì 13 ottobre 2026 A: Tiziana Oggetto: Demo*",
      "Buongiorno Tiziana,",
      "possiamo vederci domani.",
      "A presto,",
      "Paolo",
      "Il 2026-10-13 11:13 Tiziana Pietrolungo ha scritto:",
      "Buongiorno Paolo,",
      "ti sarei grata se potessi aiutarmi.",
      "Saluti cordiali",
      "Tiziana Pietrolungo Consulente del Lavoro",
    ].join("\n");

    const thread = splitEmailThreadDetails(details);

    expect(thread.signatureAndFooter).toContain("Cell +39 3474726242");
    expect(thread.signatureAndFooter).toContain("Privacy e footer dello studio");
    expect(thread.quotedEmails).toHaveLength(2);

    const firstQuote = splitEmailBodySections(thread.quotedEmails[0].body);
    expect(firstQuote.message).toContain("possiamo vederci domani.");
    expect(firstQuote.details).toContain("Paolo");

    const secondQuote = splitEmailBodySections(thread.quotedEmails[1].body);
    expect(secondQuote.message).toContain("ti sarei grata se potessi aiutarmi.");
    expect(secondQuote.details).toContain("Tiziana Pietrolungo");
  });
});
