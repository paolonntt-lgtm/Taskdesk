import { useEffect } from 'react';

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

export function useKeyboardShortcut(
  key: string,
  callback: (e: KeyboardEvent) => void,
  options?: { enabled?: boolean; allowInInput?: boolean }
) {
  const { enabled = true, allowInInput = false } = options ?? {};

  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if (!allowInInput && isInputFocused()) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === key) {
        e.preventDefault();
        callback(e);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [key, callback, enabled, allowInInput]);
}
