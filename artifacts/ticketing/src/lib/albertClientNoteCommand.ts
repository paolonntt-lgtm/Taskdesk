export interface AlbertClientNoteCommand {
  clientSlug: string;
  noteText: string;
}

const MENTION_PREFIX = /^\s*@([\w.-]+)\s*(.*)$/is;
const NOTE_ACTION = /^(?:aggiungi|crea|scrivi|inserisci|add|create|write)\s+(?:una\s+)?(?:nota|note)\b(?:\s+(?:a|per))?\s*[:,-]?\s*/i;

export function parseAlbertClientNoteDraft(message: string): AlbertClientNoteCommand | null {
  const match = message.match(MENTION_PREFIX);
  if (!match) return null;
  return { clientSlug: match[1], noteText: match[2].replace(NOTE_ACTION, '').trim() };
}

export function parseAlbertClientNoteCommand(message: string): AlbertClientNoteCommand | null {
  const match = message.match(MENTION_PREFIX);
  if (!match || !NOTE_ACTION.test(match[2].trim())) return null;
  return parseAlbertClientNoteDraft(message);
}
