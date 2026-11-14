import { describe, expect, it } from 'vitest';
import { preprocessContent } from './MarkdownContent';

describe('preprocessContent mentions', () => {
  it('removes the visible at-sign while preserving Markdown and ticket links', () => {
    expect(preprocessContent('Hi @[Alex Rossi], see #42 and [guide](https://example.test).'))
      .toBe('Hi [Alex Rossi](#mention-Alex%20Rossi), see [#42](/tickets/42) and [guide](https://example.test).');
  });

  it('leaves existing Markdown links and code spans unchanged', () => {
    expect(preprocessContent('@[Alex Rossi], [guide](https://example.test) and `@[Alex Rossi]`'))
      .toBe('[Alex Rossi](#mention-Alex%20Rossi), [guide](https://example.test) and `@[Alex Rossi]`');
  });
});
