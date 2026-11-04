export interface AlbertClientNoteCommand {
  clientSlug: string;
  noteText: string;
}

export function parseAlbertClientNoteCommand(message: string): AlbertClientNoteCommand | null {
  const match = message.match(
    /^\s*@([\w.-]+)\s+(?:aggiungi|crea|scrivi|inserisci|add|create|write)\s+(?:una\s+)?(?:nota|note)\b(?:\s+(?:a|per))?\s*[:,-]?\s*(.*)$/is,
  );
  if (!match) return null;
  return { clientSlug: match[1], noteText: match[2].trim() };
}
