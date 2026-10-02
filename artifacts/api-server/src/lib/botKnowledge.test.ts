import { describe, expect, it } from "vitest";
import {
  extractKeywords,
  formatKnowledgeArticles,
  getDeviceKnowledgeGuidance,
} from "./botKnowledge";

const aliasArticle = {
  title: "Codici BTM: Porto (Verdi)",
  content: "Porto e Verdi indicano la stessa sede. BTM1: DEMO-BTM1-PORTO. Elenco parziale.",
};

describe("Albert knowledge-base guidance", () => {
  it("keeps either site alias in the article search terms", () => {
    expect(extractKeywords("Mi dai il codice del BTM1 a Porto?")).toEqual(
      expect.arrayContaining(["btm1", "porto"]),
    );
    expect(extractKeywords("What is the BTM1 code at Verdi?")).toEqual(
      expect.arrayContaining(["btm1", "verdi"]),
    );
  });

  it("includes the exact article title and documented mapping in both prompts", () => {
    const italianContext = formatKnowledgeArticles([aliasArticle], "it");
    const englishContext = formatKnowledgeArticles([aliasArticle], "en");

    expect(italianContext).toContain("--- ARTICOLI KNOWLEDGE BASE ---");
    expect(englishContext).toContain("--- KNOWLEDGE BASE ARTICLES ---");
    for (const context of [italianContext, englishContext]) {
      expect(context).toContain("Codici BTM: Porto (Verdi)");
      expect(context).toContain("Porto e Verdi indicano la stessa sede");
      expect(context).toContain("DEMO-BTM1-PORTO");
    }
  });

  it("requires explicit mappings and offers only documented, accurately labelled lists", () => {
    const italian = getDeviceKnowledgeGuidance("it");
    const english = getDeviceKnowledgeGuidance("en");

    expect(italian).toContain("Non inventare codici");
    expect(italian).toContain("Definisci l’elenco parziale");
    expect(italian).toContain("non proporre di aprire o creare un ticket");
    expect(english).toContain("Never invent a code");
    expect(english).toContain("Call the list partial");
    expect(english).toContain("do not offer to open or create a ticket");
  });

  it("renders no knowledge-base section when no article was found", () => {
    expect(formatKnowledgeArticles([], "it")).toBe("");
    expect(formatKnowledgeArticles([], "en")).toBe("");
  });
});