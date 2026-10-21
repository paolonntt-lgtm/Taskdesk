import { describe, expect, it } from "vitest";
import { prefixTicketTitleWithClient } from "./clientTicketTitle";

describe("prefixTicketTitleWithClient", () => {
  it("adds the client name before the original title", () => {
    expect(prefixTicketTitleWithClient("Richiesta preventivo", "IA PAOLO SNC"))
      .toBe("IA PAOLO SNC — Richiesta preventivo");
  });

  it("does not add the same client prefix twice", () => {
    expect(prefixTicketTitleWithClient("IA PAOLO SNC — Richiesta preventivo", "IA PAOLO SNC"))
      .toBe("IA PAOLO SNC — Richiesta preventivo");
  });

  it("replaces a previous client prefix when reassociating", () => {
    expect(prefixTicketTitleWithClient(
      "Cliente precedente — Richiesta preventivo",
      "IA PAOLO SNC",
      "Cliente precedente",
    )).toBe("IA PAOLO SNC — Richiesta preventivo");
  });

  it("leaves the title unchanged when the client name is blank", () => {
    expect(prefixTicketTitleWithClient("Richiesta preventivo", " ")).toBe("Richiesta preventivo");
  });
});
