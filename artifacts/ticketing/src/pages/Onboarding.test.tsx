// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({ user: null as any }));
const languageState = vi.hoisted(() => ({ value: null as any }));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: authState.user }),
}));
vi.mock('../contexts/LanguageContext', () => ({
  useLanguage: () => languageState.value,
}));
vi.mock('../lib/analytics', () => ({
  trackEvent: vi.fn(),
}));

import Onboarding from './Onboarding';
import { translations } from '../i18n/translations';

describe('profession step in onboarding', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    authState.user = { id: 12, role: 'admin', profession: 'avvocati' };
    languageState.value = { lang: 'en', t: translations.en, setLang: vi.fn() };
    sessionStorage.clear();
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.restoreAllMocks();
  });

  it('skips profession selection when registration already saved it', async () => {
    await act(async () => {
      root.render(<Onboarding onComplete={vi.fn()} />);
    });

    expect(host.textContent).toContain(translations.en.onboarding.stepInviteTeam);
    expect(host.textContent).not.toContain(translations.en.onboarding.title);
  });

  it('keeps profession selection for an account without a saved profession', async () => {
    authState.user = { id: 12, role: 'admin', profession: null };

    await act(async () => {
      root.render(<Onboarding onComplete={vi.fn()} />);
    });

    expect(host.textContent).toContain(translations.en.onboarding.title);
    expect(host.textContent).toContain(translations.en.onboarding.types.avvocati.label);
  });
});
