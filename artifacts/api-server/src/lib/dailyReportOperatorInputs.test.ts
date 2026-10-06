import { describe, expect, it } from "vitest";
import {
  formatDailyReportOperatorInputs,
  sanitizeDailyReportOperatorInputs,
} from "./dailyReportOperatorInputs";

describe("daily report operator inputs", () => {
  it("keeps collaborator notes in order and ignores malformed or blank entries", () => {
    expect(sanitizeDailyReportOperatorInputs([
      " Aggiungi che il cliente richiama domani ",
      null,
      "",
      42,
      "Verificare la risposta del fornitore",
    ])).toEqual([
      "Aggiungi che il cliente richiama domani",
      "Verificare la risposta del fornitore",
    ]);
  });

  it("bounds the report context while retaining the newest notes", () => {
    const inputs = Array.from({ length: 4 }, (_, index) => `${index + 1}:${"x".repeat(1998)}`);
    const sanitized = sanitizeDailyReportOperatorInputs(inputs);

    expect(sanitized).toHaveLength(3);
    expect(sanitized[0]).toContain("2:");
    expect(sanitized[2]).toContain("4:");
    expect(sanitized.join("").length).toBeLessThanOrEqual(6000);
  });

  it("formats collaborator messages as a chronological prompt section", () => {
    const section = formatDailyReportOperatorInputs([
      "Il cliente richiama domani",
      "Aggiungi che il fornitore ha confermato",
    ], "it");

    expect(section).toContain("MESSAGGI DEL COLLABORATORE");
    expect(section.indexOf("Il cliente richiama domani"))
      .toBeLessThan(section.indexOf("il fornitore ha confermato"));
  });

  it("omits the section when there are no collaborator inputs", () => {
    expect(formatDailyReportOperatorInputs([], "en")).toBe("");
  });
});
