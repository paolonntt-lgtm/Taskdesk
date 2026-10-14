// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const noteStore = vi.hoisted(() => ({
  notes: [] as any[],
  update: vi.fn(),
}));

vi.mock('@workspace/api-client-react', () => ({
  useListClientNotes: () => ({ data: noteStore.notes, isLoading: false }),
  useCreateClientNote: () => ({ mutateAsync: vi.fn() }),
  useUpdateClientNote: () => ({ mutateAsync: (args: any) => noteStore.update(args) }),
  useDeleteClientNote: () => ({ mutateAsync: vi.fn() }),
  getListClientNotesQueryKey: (clientId: number) => ['client-notes', clientId],
  getListAllClientNotesQueryKey: () => ['client-notes', 'all'],
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

import ClientNotesBlock from './ClientNotesBlock';

const originalNote = {
  id: 42,
  clientId: 7,
  authorId: 11,
  authorName: 'Ada Lovelace',
  body: 'Contesto da conservare',
  monthOverride: '2026-08',
  createdAt: '2026-08-12T10:00:00.000Z',
  checklist: [
    {
      id: 'checked-item',
      text: 'Contratto verificato',
      checked: true,
      checkedByName: 'Ada Lovelace',
      checkedAt: '2026-08-12T11:00:00.000Z',
    },
    { id: 'open-item', text: 'Inviare conferma', checked: false },
  ],
};

const otherAugustNote = {
  id: 43,
  clientId: 7,
  authorId: 11,
  authorName: 'Ada Lovelace',
  body: 'Altra nota di agosto',
  monthOverride: '2026-08',
  createdAt: '2026-08-13T10:00:00.000Z',
  checklist: null,
};

const septemberNote = {
  id: 44,
  clientId: 7,
  authorId: 11,
  authorName: 'Ada Lovelace',
  body: 'Nota già presente a settembre',
  monthOverride: '2026-09',
  createdAt: '2026-09-01T10:00:00.000Z',
  checklist: null,
};

describe('ClientNotesBlock monthly note editing', () => {
  let host: HTMLDivElement;
  let root: Root;

  const renderNotes = async () => {
    await act(async () => {
      root.render(
        React.createElement(ClientNotesBlock, {
          clientId: 7,
          isAdmin: true,
          currentUserId: 11,
        }),
      );
    });
  };

  const byTestId = <T extends Element>(id: string): T => {
    const element = host.querySelector(`[data-testid="${id}"]`);
    if (!element) throw new Error(`Missing test element: ${id}`);
    return element as T;
  };

  const click = async (id: string) => {
    await act(async () => {
      byTestId<HTMLElement>(id).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  };

  beforeEach(async () => {
    noteStore.notes = structuredClone([originalNote, otherAugustNote, septemberNote]);
    noteStore.update.mockReset().mockImplementation(async ({ noteId, data }: any) => {
      let updatedNote: any;
      noteStore.notes = noteStore.notes.map((note) => {
        if (note.id !== noteId) return note;
        updatedNote = { ...note, ...data };
        return updatedNote;
      });
      return updatedNote;
    });
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await renderNotes();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it('moves a note to the selected month without changing its text or checklist, including after reload', async () => {
    await click('client-note-month-2026-08');
    expect(byTestId('client-note-42')).toBeTruthy();

    await click('client-note-edit-42');
    const monthInput = byTestId<HTMLInputElement>('client-note-edit-month-42');
    const setInputValue = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set;
    if (!setInputValue) throw new Error('HTML month input value setter is unavailable');
    setInputValue?.call(monthInput, '2026-09');
    await act(async () => {
      monthInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await click('client-note-save-42');

    expect(noteStore.update).toHaveBeenCalledOnce();
    expect(noteStore.update).toHaveBeenCalledWith({
      id: 7,
      noteId: 42,
      data: { monthOverride: '2026-09' },
    });
    expect(host.querySelector('[data-testid="client-note-42"]')).toBeNull();
    expect(host.textContent).toContain('Altra nota di agosto');

    await click('client-note-month-2026-09');
    const movedNote = byTestId<HTMLElement>('client-note-42');
    expect(movedNote.textContent).toContain('Contesto da conservare');
    expect(movedNote.textContent).toContain('Contratto verificato');
    expect(movedNote.textContent).toContain('Inviare conferma');
    expect(Array.from(movedNote.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'))
      .map((checkbox) => checkbox.checked)).toEqual([true, false]);

    await act(async () => root.unmount());
    root = createRoot(host);
    await renderNotes();

    const noteAfterReload = byTestId<HTMLElement>('client-note-42');
    expect(noteAfterReload.textContent).toContain('Contesto da conservare');
    expect(noteAfterReload.textContent).toContain('Contratto verificato');
    expect(noteAfterReload.textContent).toContain('Inviare conferma');
    expect(Array.from(noteAfterReload.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'))
      .map((checkbox) => checkbox.checked)).toEqual([true, false]);
    await click('client-note-month-2026-08');
    expect(host.querySelector('[data-testid="client-note-42"]')).toBeNull();
    await click('client-note-month-2026-09');
    expect(host.querySelector('[data-testid="client-note-42"]')).not.toBeNull();
  });
});
