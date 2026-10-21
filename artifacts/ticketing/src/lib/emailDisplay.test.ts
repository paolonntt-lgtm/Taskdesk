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

  it("keeps Italian replies in thread order without treating signatures or footers as replies", () => {
    const details = [
      "Firma e recapiti del mittente",
      "--",
      "Informativa sulla privacy",
      "Il giorno 21 ottobre 2026, Paolo ha scritto:",
      "Prima risposta citata",
      "Cordiali saluti",
      "Paolo",
      "Il giorno 20 ottobre 2026, Tiziana ha scritto:",
      "Seconda risposta citata",
      "Grazie",
      "Tiziana",
    ].join("\n");

    const thread = splitEmailThreadDetails(details);

    expect(thread.quotedEmails.map(({ header }) => header)).toEqual([
      "Il giorno 21 ottobre 2026, Paolo ha scritto:",
      "Il giorno 20 ottobre 2026, Tiziana ha scritto:",
    ]);
    expect(thread.quotedEmails.map(({ body }) => body)).toEqual([
      "Prima risposta citata\nCordiali saluti\nPaolo",
      "Seconda risposta citata\nGrazie\nTiziana",
    ]);
    expect(thread.signatureAndFooter).toContain("Firma e recapiti del mittente");
    expect(thread.signatureAndFooter).toContain("Informativa sulla privacy");
  });

  it("splits long nested Italian forwards even when the sign-off shares a line with the main message", () => {
    const body = [
      "Sì, dalle ore 8.00 alle ore 12.00 Buona giornata AV",
      "",
      "Il giorno lun 12 ott 2026 alle ore 21:13 Paolo Iannetti <paolo@example.com> ha scritto:",
      "> Buonasera,",
      "> il tecnico oggi non è venuto per via del maltempo, posso passare domani mattina a prendere le chiavi?",
      "> grazie",
      ">",
      "> Il giorno ven 9 ott 2026 alle ore 08:23 STUDIO VITTIGLIO <studio@example.com> ha scritto:",
      "> Assolutamente sì, dalle ore 8.00 alle ore 12.00. Un cordiale saluto e buon fine settimana.",
      ">",
      "> > Il giorno gio 8 ott 2026 alle ore 21:59 Paolo Iannetti <paolo@example.com> ha scritto:",
      "> > Buonasera,",
      "> > Abbiamo problemi tecnici alla parabola e un tecnico verrà a risolvere il problema lunedì pomeriggio.",
      "> >",
      "> > > Il Ven 18 Apr 2025, 21:21 Paolo Iannetti <paolo@example.com> ha scritto:",
      "> > > Buonasera, Perdonate l'orario ma da questo pomeriggio abbiamo problemi con la parabola sul tetto.",
    ].join("\n");

    const sections = splitEmailBodySections(body);
    const thread = splitEmailThreadDetails(sections.details);

    expect(sections.message).toBe("Sì, dalle ore 8.00 alle ore 12.00 Buona giornata AV");
    expect(thread.quotedEmails).toHaveLength(4);
    expect(thread.quotedEmails.map(({ header }) => header)).toEqual([
      "Il giorno lun 12 ott 2026 alle ore 21:13 Paolo Iannetti <paolo@example.com> ha scritto:",
      "Il giorno ven 9 ott 2026 alle ore 08:23 STUDIO VITTIGLIO <studio@example.com> ha scritto:",
      "Il giorno gio 8 ott 2026 alle ore 21:59 Paolo Iannetti <paolo@example.com> ha scritto:",
      "Il Ven 18 Apr 2025, 21:21 Paolo Iannetti <paolo@example.com> ha scritto:",
    ]);
    expect(thread.quotedEmails[3].body).toContain("problemi con la parabola");
    expect(thread.quotedEmails[0].body).toContain("Buonasera");
    expect(thread.quotedEmails[0].body).not.toMatch(/^>/m);
  });

  it("recognizes English quoted replies and preserves their original order", () => {
    const details = [
      "Best regards,",
      "Current sender",
      "On October 21, 2026, Alex wrote:",
      "First quoted reply",
      "Regards,",
      "Alex",
      "From: Jamie <jamie@example.com>",
      "Second quoted reply",
    ].join("\n");

    const thread = splitEmailThreadDetails(details);

    expect(thread.quotedEmails.map(({ header }) => header)).toEqual([
      "On October 21, 2026, Alex wrote:",
      "From: Jamie <jamie@example.com>",
    ]);
    expect(thread.quotedEmails.map(({ body }) => body)).toEqual([
      "First quoted reply\nRegards,\nAlex",
      "Second quoted reply",
    ]);
    expect(thread.signatureAndFooter).toBe("Best regards,\nCurrent sender");
  });

  it("returns no extra quoted sections for a single reply or a message without quoted replies", () => {
    const singleReply = splitEmailThreadDetails("Sent from my phone\nIl 21 ottobre 2026, Paolo ha scritto:\nRisposta precedente");
    const noReplies = splitEmailThreadDetails("Firma\nFooter informativo");

    expect(singleReply.quotedEmails).toHaveLength(1);
    expect(noReplies.quotedEmails).toHaveLength(0);
    expect(noReplies.signatureAndFooter).toBe("Firma\nFooter informativo");
  });
});
