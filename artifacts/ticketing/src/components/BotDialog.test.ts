// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const chatRequests = vi.hoisted(() => ({
  bodies: [] as Array<Record<string, unknown>>,
}));

vi.mock('../hooks/useEntityTerm', () => ({
  useEntityTerm: () => ({
    singular: 'ticket',
    plural: 'ticket',
    singularLower: 'ticket',
    pluralLower: 'ticket',
    navAll: 'Tutti i ticket',
    navNew: 'Nuovo ticket',
    articleIndef: 'un',
  }),
}));

vi.mock('../lib/analytics', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('./AlbertAvatarIcon', () => ({
  AlbertAvatarIcon: () => React.createElement('span'),
}));

vi.mock('./MarkdownContent', () => ({
  MarkdownContent: ({ content }: { content: string }) => React.createElement('div', null, content),
}));

import BotDialog from './BotDialog';

const sessionKey = 'td_bot_session';

function sessionWithLatestReply(reply: string) {
  sessionStorage.setItem(sessionKey, JSON.stringify({
    messages: [
      { role: 'user', content: 'Ho bisogno di aiuto.' },
      { role: 'assistant', content: reply },
    ],
    pendingAction: null,
  }));
}

describe('BotDialog follow-up actions', () => {
  let host: HTMLDivElement;
  let root: Root;
  let originalScrollIntoView: Element['scrollIntoView'] | undefined;

  const renderDialog = async () => {
    await act(async () => {
      root.render(
        React.createElement(BotDialog, {
          open: true,
          onClose: vi.fn(),
          onCreateTicket: vi.fn(),
        }),
      );
    });
  };

  const click = async (testId: string) => {
    const button = host.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
    if (!button) throw new Error(`Missing button: ${testId}`);
    await act(async () => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  };

  beforeEach(async () => {
    chatRequests.bodies = [];
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    originalScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = vi.fn();
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/daily-reports/today-mine')) {
        return { json: async () => ({ submitted: false }) };
      }
      if (url.endsWith('/api/settings/locations')) {
        return { json: async () => ({ value: [] }) };
      }
      if (url.endsWith('/api/bot/chat')) {
        chatRequests.bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
        let read = false;
        return {
          ok: true,
          body: {
            getReader: () => ({
              read: async () => {
                if (read) return { done: true, value: undefined };
                read = true;
                return {
                  done: false,
                  value: new TextEncoder().encode('data: {"content":"Ricevuto."}\n\ndata: [DONE]\n\n'),
                };
              },
            }),
          },
        };
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }));

    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    sessionStorage.clear();
    if (originalScrollIntoView) {
      Element.prototype.scrollIntoView = originalScrollIntoView;
    } else {
      delete (Element.prototype as Partial<Element>).scrollIntoView;
    }
    vi.unstubAllGlobals();
  });

  it.each([
    ['Sì', 'follow-up-yes'],
    ['No', 'follow-up-no'],
  ])('renders %s for a question and sends that choice in the conversation', async (choice, testId) => {
    sessionWithLatestReply('Hai già riavviato il dispositivo?');
    await renderDialog();

    const yesNoButtons = host.querySelectorAll('[data-testid^="button-bot-option-follow-up-"]');
    expect(Array.from(yesNoButtons).map((button) => button.textContent?.trim())).toEqual(['Sì', 'No']);
    await click(`button-bot-option-${testId}`);

    expect(chatRequests.bodies).toHaveLength(1);
    expect(chatRequests.bodies[0].message).toBe(choice);
    expect(host.textContent).toContain(choice);
  });

  it.each([
    'Il riavvio ha risolto il problema.',
    'Nessun ticket aperto contiene Sky.',
  ])('does not offer ticket creation for a useful response or a no-match search: %s', async (reply) => {
    sessionWithLatestReply(reply);
    await renderDialog();

    expect(host.textContent).not.toContain('Apri ticket');
    expect(host.querySelector('[data-testid^="button-bot-option-follow-up-"]')).toBeNull();
  });

  it('offers opening a ticket only when Albert explicitly says he could not help', async () => {
    sessionWithLatestReply('Non sono riuscito ad aiutarti con questo problema.');
    await renderDialog();

    expect(host.textContent).toContain('Apri ticket');
    expect(host.querySelector('[data-testid="button-bot-option-follow-up-yes"]')).toBeNull();
    expect(host.querySelector('[data-testid="button-bot-option-follow-up-no"]')).toBeNull();
  });
});
