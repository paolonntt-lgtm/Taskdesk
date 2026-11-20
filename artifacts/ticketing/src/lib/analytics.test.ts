import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { trackAfterSuccess } from './analytics';

describe('trackAfterSuccess', () => {
  const track = vi.fn();

  beforeEach(() => {
    track.mockReset();
    vi.stubGlobal('window', { umami: { track } });
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each([
    ['workspace_switched', { workspace_kind: 'home' }],
    ['workspace_switched', { workspace_kind: 'shared' }],
    ['client_created', { source: 'clients_page' }],
  ] as const)('tracks %s after its action succeeds with only safe dimensions', async (name, data) => {
    let resolveAction!: (value: string) => void;
    const action = vi.fn(() => new Promise<string>((resolve) => { resolveAction = resolve; }));
    const result = trackAfterSuccess(action, name, data);
    expect(track).not.toHaveBeenCalled();

    resolveAction('success');
    await expect(result).resolves.toBe('success');

    expect(action).toHaveBeenCalledOnce();
    expect(track).toHaveBeenCalledOnce();
    expect(track).toHaveBeenCalledWith(name, data);
  });

  it.each([
    ['workspace_switched', { workspace_kind: 'home' }],
    ['client_created', { source: 'clients_page' }],
  ] as const)('does not track %s when its action fails', async (name, data) => {
    const failure = new Error('Action failed');
    const action = vi.fn().mockRejectedValue(failure);

    await expect(trackAfterSuccess(action, name, data)).rejects.toBe(failure);

    expect(track).not.toHaveBeenCalled();
  });
});
