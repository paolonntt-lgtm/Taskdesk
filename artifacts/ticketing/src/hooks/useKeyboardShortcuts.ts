import { useEffect, useMemo } from 'react';

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

/**
 * Register a global keydown shortcut.
 * Fires only when no input/textarea/contenteditable is focused and no meta/ctrl/alt keys are held.
 *
 * @param key - A single key string or array of key strings to match against `e.key`
 * @param callback - Called when the key is pressed
 * @param options.enabled - Set to false to temporarily disable (default: true)
 * @param options.allowInInput - If true, fires even when an input is focused (default: false)
 */
export function useKeyboardShortcut(
  key: string | readonly string[],
  callback: (e: KeyboardEvent) => void,
  options?: { enabled?: boolean; allowInInput?: boolean }
) {
  const { enabled = true, allowInInput = false } = options ?? {};

  // Stable set from the key(s) — avoids re-running the effect on every render
  const keyStr = Array.isArray(key) ? (key as string[]).join('\x00') : (key as string);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const keySet = useMemo(() => new Set(Array.isArray(key) ? key as string[] : [key as string]), [keyStr]);

  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if (!allowInInput && isInputFocused()) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (keySet.has(e.key)) {
        e.preventDefault();
        callback(e);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [keySet, callback, enabled, allowInInput]);
}
