import { describe, expect, it } from "vitest";
import { cleanForwardedEmailBody } from "./emailTextCleanup";

describe("cleanForwardedEmailBody", () => {
  it("removes Gmail forward headers and keeps an introductory note and message", () => {
    const result = cleanForwardedEmailBody(
      [
        "Per conoscenza, ecco la richiesta.",
        "---------- Forwarded message ---------",
        "From: Cliente <cliente@example.com>",
        "Date: Tue, 14 Oct 2026 10:00:00 +0200",
        "Subject: Problema urgente",
        "To: support@example.com",
        "",
        "Il servizio è fermo da stamattina.",
      ].join("\n"),
    );

    expect(result).toBe("Per conoscenza, ecco la richiesta.\n\nIl servizio è fermo da stamattina.");
  });

  it("removes Italian Outlook original-message headers", () => {
    const result = cleanForwardedEmailBody(
      [
        "-----Messaggio originale-----",
        "Da: Cliente <cliente@example.com>",
        "Inviato: martedì 14 ottobre 2026 10:00",
        "A: support@example.com",
        "Oggetto: Errore fattura",
        "",
        "La fattura allegata riporta un importo errato.",
      ].join("\n"),
    );

    expect(result).toBe("La fattura allegata riporta un importo errato.");
  });

  it("handles flattened Gmail headers and removes the signature footer and older thread", () => {
    const result = cleanForwardedEmailBody(
      [
        "---------- Forwarded message --------- Da: Mittente <mittente@example.com> Date: mar 13 ott 2026 Subject: Richiesta di aiuto To: paolo@example.com",
        "",
        "Buongiorno, ho incontrato alcune difficoltà e avrei bisogno di aiuto.",
        "Resto in attesa di un riscontro. Saluti cordiali",
        "",
        "*Mittente*",
        "Consulente",
        "Telefono e recapito",
        "--",
        "Firma legale e informazioni sulla privacy",
        "Da: paolo@example.com Inviato: martedì 13 ottobre 2026 A: mittente@example.com Oggetto: Richiesta di aiuto",
        "Testo della conversazione precedente",
      ].join("\n"),
    );

    expect(result).toBe(
      [
        "Buongiorno, ho incontrato alcune difficoltà e avrei bisogno di aiuto.",
        "Resto in attesa di un riscontro. Saluti cordiali",
        "",
        "*Mittente*",
        "Consulente",
        "Telefono e recapito",
      ].join("\n"),
    );
  });

  it("leaves unrecognized or ambiguous content unchanged", () => {
    const body = "---------- Forwarded message ---------\nTesto senza intestazioni riconoscibili";
    expect(cleanForwardedEmailBody(body)).toBe(body);
  });

  it("leaves regular email text unchanged", () => {
    const body = "Buongiorno, potete verificare questa pratica?\nGrazie.";
    expect(cleanForwardedEmailBody(body)).toBe(body);
  });
});
