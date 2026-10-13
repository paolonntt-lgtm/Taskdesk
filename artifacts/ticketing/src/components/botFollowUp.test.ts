import { describe, expect, it } from 'vitest';
import { shouldShowYesNoReplies } from './botFollowUp';

describe('Albert quick replies', () => {
  it('shows yes/no for questions and optional follow-up offers', () => {
    expect(shouldShowYesNoReplies('Hai controllato un sito specifico?')).toBe(true);
    expect(shouldShowYesNoReplies(
      'Se vuoi, posso fare un controllo più mirato per uno specifico sito o per un ticket Sky in particolare.'
    )).toBe(true);
    expect(shouldShowYesNoReplies('Would you like me to search again?')).toBe(true);
    expect(shouldShowYesNoReplies('If you want, I can check a specific site.')).toBe(true);
  });

  it('does not show yes/no on a plain answer', () => {
    expect(shouldShowYesNoReplies('Nessun ticket aperto contiene Sky.')).toBe(false);
  });
});
