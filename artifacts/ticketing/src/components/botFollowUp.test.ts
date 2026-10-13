import { describe, expect, it } from 'vitest';
import { isYesNoFollowUpOffer } from './botFollowUp';

describe('isYesNoFollowUpOffer', () => {
  it('recognizes the Italian optional lookup offer', () => {
    expect(isYesNoFollowUpOffer(
      'Se vuoi, posso fare un controllo più mirato per uno specifico sito o per un ticket Sky in particolare.'
    )).toBe(true);
  });

  it('recognizes English offers and direct yes/no questions', () => {
    expect(isYesNoFollowUpOffer("If you want, I can check a specific site.")).toBe(true);
    expect(isYesNoFollowUpOffer('Would you like me to search again?')).toBe(true);
  });

  it('does not replace ticket creation with a yes/no suggestion', () => {
    expect(isYesNoFollowUpOffer('Se vuoi, posso aprire un ticket per te.')).toBe(false);
    expect(isYesNoFollowUpOffer('I found two matching tickets.')).toBe(false);
  });
});
