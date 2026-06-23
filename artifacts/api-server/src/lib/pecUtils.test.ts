import { describe, it, expect } from "vitest";
import { tryUnwrapPec, cleanPecSubject } from "./pecUtils";

// ---------------------------------------------------------------------------
// Helpers to build synthetic MIME messages
// ---------------------------------------------------------------------------

function buildTextPart(subject: string, body: string): string {
  return [
    `From: sender@example.com`,
    `To: dest@example.com`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=utf-8`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    body,
  ].join("\r\n");
}

function buildPecEnvelope(innerEml: string, subject: string, xTrasporto = "posta-certificata"): string {
  const boundary = "pec_boundary_001";
  const innerB64 = Buffer.from(innerEml, "utf8").toString("base64");

  return [
    `From: posta-certificata@legalmail.it`,
    `To: azienda@legalmail.it`,
    `Subject: ${subject}`,
    `X-Trasporto: ${xTrasporto}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=utf-8`,
    ``,
    `Questo messaggio e' stato inviato tramite il servizio di Posta Elettronica Certificata.`,
    ``,
    `--${boundary}`,
    `Content-Type: message/rfc822`,
    `Content-Disposition: attachment; filename="postacert.eml"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    innerB64,
    ``,
    `--${boundary}--`,
  ].join("\r\n");
}

// ---------------------------------------------------------------------------
// cleanPecSubject
// ---------------------------------------------------------------------------

describe("cleanPecSubject", () => {
  it("strips POSTA CERTIFICATA: prefix", () => {
    expect(cleanPecSubject("POSTA CERTIFICATA: Fattura n. 123")).toBe("Fattura n. 123");
  });

  it("strips ACCETTAZIONE: prefix", () => {
    expect(cleanPecSubject("ACCETTAZIONE: Richiesta di supporto")).toBe("Richiesta di supporto");
  });

  it("strips Messaggio PEC inoltrato prefix", () => {
    expect(cleanPecSubject("Messaggio PEC inoltrato Fineco: bonifico istantaneo in ingresso")).toBe(
      "Fineco: bonifico istantaneo in ingresso",
    );
  });

  it("strips [ANOMALIA MESSAGGIO: ...] bracketed tag", () => {
    expect(
      cleanPecSubject("[ANOMALIA MESSAGGIO: Fineco: bonifico istantaneo in ingresso] Fineco: bonifico istantaneo in ingresso"),
    ).toBe("Fineco: bonifico istantaneo in ingresso");
  });

  it("strips combined prefix: Messaggio PEC inoltrato + [ANOMALIA MESSAGGIO: ...]", () => {
    const raw =
      "Messaggio PEC inoltrato [ANOMALIA MESSAGGIO: Fineco: bonifico istantaneo in ingresso] Fineco: bonifico istantaneo in ingresso";
    expect(cleanPecSubject(raw)).toBe("Fineco: bonifico istantaneo in ingresso");
  });

  it("is case-insensitive", () => {
    expect(cleanPecSubject("posta certificata: Test")).toBe("Test");
    expect(cleanPecSubject("accettazione: Test")).toBe("Test");
  });

  it("leaves unrelated subjects unchanged", () => {
    expect(cleanPecSubject("Fattura n. 123")).toBe("Fattura n. 123");
    expect(cleanPecSubject("Fineco: bonifico")).toBe("Fineco: bonifico");
  });
});

// ---------------------------------------------------------------------------
// tryUnwrapPec — single-level
// ---------------------------------------------------------------------------

describe("tryUnwrapPec — single-level PEC envelope", () => {
  it("returns isPec:false for a plain non-PEC email", () => {
    const plain = buildTextPart("Hello world", "Just a regular email.");
    const result = tryUnwrapPec(plain, {});
    expect(result.isPec).toBe(false);
  });

  it("returns isReceipt:true for avvenuta-consegna", () => {
    const envelope = buildPecEnvelope(
      buildTextPart("Avvenuta consegna", "Delivered."),
      "AVVENUTA CONSEGNA: test",
      "avvenuta-consegna",
    );
    const result = tryUnwrapPec(envelope, { "X-Trasporto": "avvenuta-consegna" });
    expect(result.isPec).toBe(true);
    if (result.isPec) expect(result.isReceipt).toBe(true);
  });

  it("unwraps a single-level PEC envelope and returns the inner subject and body", () => {
    const innerEml = buildTextPart("Richiesta di supporto", "Per favore aiutatemi.");
    const outerEml = buildPecEnvelope(
      innerEml,
      "POSTA CERTIFICATA: Richiesta di supporto",
      "posta-certificata",
    );

    const result = tryUnwrapPec(outerEml, { "X-Trasporto": "posta-certificata" });

    expect(result.isPec).toBe(true);
    if (!result.isPec || result.isReceipt) throw new Error("Expected PEC non-receipt result");
    expect(result.subject).toBe("Richiesta di supporto");
    expect(result.text).toContain("Per favore aiutatemi.");
    expect(result.attachments).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// tryUnwrapPec — double-wrapped legalmail inoltro
// ---------------------------------------------------------------------------

describe("tryUnwrapPec — double-wrapped legalmail PEC (inoltro anomalia)", () => {
  it("extracts the real Fineco email from a double-wrapped PEC envelope", () => {
    // Level 3: the actual Fineco bank-transfer notification
    const finecoEml = buildTextPart(
      "Fineco: bonifico istantaneo in ingresso",
      "Hai ricevuto un bonifico istantaneo di €100,00 da Mario Rossi.",
    );

    // Level 2: inner PEC forwarding wrapper ("postacert.eml inside postacert.eml")
    const innerPecEml = buildPecEnvelope(
      finecoEml,
      "Messaggio PEC inoltrato [ANOMALIA MESSAGGIO: Fineco: bonifico istantaneo in ingresso] Fineco: bonifico istantaneo in ingresso",
      "posta-certificata",
    );

    // Level 1: outer PEC envelope received by the webhook
    const outerPecEml = buildPecEnvelope(
      innerPecEml,
      "POSTA CERTIFICATA: Messaggio PEC inoltrato [ANOMALIA MESSAGGIO: Fineco: bonifico istantaneo in ingresso]",
      "posta-certificata",
    );

    const result = tryUnwrapPec(outerPecEml, { "X-Trasporto": "posta-certificata" });

    expect(result.isPec).toBe(true);
    if (!result.isPec || result.isReceipt) throw new Error("Expected PEC non-receipt result");

    // Subject must be the clean Fineco subject, not any PEC infrastructure prefix
    expect(result.subject).toBe("Fineco: bonifico istantaneo in ingresso");

    // Body must be the actual Fineco notification content
    expect(result.text).toContain("bonifico istantaneo di €100,00");
    expect(result.text).toContain("Mario Rossi");

    // No PEC infrastructure attachments should leak through
    expect(result.attachments).toHaveLength(0);
  });

  it("handles a double-wrapped envelope detected via MIME structure (no provider header)", () => {
    const finecoEml = buildTextPart(
      "Estratto conto Fineco",
      "Il tuo estratto conto e' disponibile.",
    );
    const innerPecEml = buildPecEnvelope(
      finecoEml,
      "Messaggio PEC inoltrato Estratto conto Fineco",
      "posta-certificata",
    );
    const outerPecEml = buildPecEnvelope(
      innerPecEml,
      "POSTA CERTIFICATA: Messaggio PEC inoltrato Estratto conto Fineco",
      "posta-certificata",
    );

    // Pass empty provider headers — detection must come from MIME structure
    const result = tryUnwrapPec(outerPecEml, {});

    expect(result.isPec).toBe(true);
    if (!result.isPec || result.isReceipt) throw new Error("Expected PEC non-receipt result");
    expect(result.subject).toBe("Estratto conto Fineco");
    expect(result.text).toContain("estratto conto");
  });
});
