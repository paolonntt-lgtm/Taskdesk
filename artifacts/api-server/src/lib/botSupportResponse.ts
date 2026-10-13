export interface BotSupportResponse {
  content: string;
  unableToHelp: boolean;
}

export function parseBotSupportResponse(content: string): BotSupportResponse | null {
  try {
    const parsed: unknown = JSON.parse(content);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("content" in parsed) ||
      typeof parsed.content !== "string" ||
      !("unableToHelp" in parsed) ||
      typeof parsed.unableToHelp !== "boolean"
    ) {
      return null;
    }

    return {
      content: parsed.content,
      unableToHelp: parsed.unableToHelp,
    };
  } catch {
    return null;
  }
}
