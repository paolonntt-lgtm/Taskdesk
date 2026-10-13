import { describe, expect, it } from "vitest";
import { parseBotSupportResponse } from "./botSupportResponse";

describe("parseBotSupportResponse", () => {
  it("parses the answer and structured failure outcome", () => {
    expect(parseBotSupportResponse(
      '{"content":"I could not resolve this issue.","unableToHelp":true}',
    )).toEqual({
      content: "I could not resolve this issue.",
      unableToHelp: true,
    });
  });

  it("preserves a successful no-match answer as a non-failure", () => {
    expect(parseBotSupportResponse(
      '{"content":"Nessun ticket aperto contiene Sky.","unableToHelp":false}',
    )).toEqual({
      content: "Nessun ticket aperto contiene Sky.",
      unableToHelp: false,
    });
  });

  it("rejects malformed or incomplete structured responses", () => {
    expect(parseBotSupportResponse("not json")).toBeNull();
    expect(parseBotSupportResponse('{"content":"Answer"}')).toBeNull();
    expect(parseBotSupportResponse('{"content":"Answer","unableToHelp":"false"}')).toBeNull();
  });
});
