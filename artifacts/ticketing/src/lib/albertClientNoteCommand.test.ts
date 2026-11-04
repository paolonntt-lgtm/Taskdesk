import { describe, expect, it } from 'vitest';
import { parseAlbertClientNoteCommand, parseAlbertClientNoteDraft } from './albertClientNoteCommand';

describe('Albert client-note command', () => {
  it('extracts a client slug and note text', () => {
    expect(parseAlbertClientNoteCommand('@acme-srl aggiungi nota: Richiamare il cliente #marzo'))
      .toEqual({ clientSlug: 'acme-srl', noteText: 'Richiamare il cliente #marzo' });
  });

  it('recognizes a command that still needs note content', () => {
    expect(parseAlbertClientNoteCommand('@acme-srl aggiungi nota a #marzo'))
      .toEqual({ clientSlug: 'acme-srl', noteText: '#marzo' });
  });

  it('does not intercept ordinary conversation', () => {
    expect(parseAlbertClientNoteCommand('@acme-srl ha già una nota?')).toBeNull();
  });

  it('accepts console-style note text after selecting a client', () => {
    expect(parseAlbertClientNoteDraft('@acme-srl Richiamare il cliente #marzo'))
      .toEqual({ clientSlug: 'acme-srl', noteText: 'Richiamare il cliente #marzo' });
  });

  it('accepts an empty draft so the composer can ask for note text', () => {
    expect(parseAlbertClientNoteDraft('@acme-srl'))
      .toEqual({ clientSlug: 'acme-srl', noteText: '' });
  });
});
