import React, { ReactNode } from 'react';
import { render } from '@testing-library/react';
import { vi } from 'vitest';
import { AuthContext, type IAuthContext } from '../../../auth/AuthContext';

/** An auth context whose every method is a spy; `overrides` replaces the ones a test cares about. */
export function makeAuth(overrides: Partial<IAuthContext> = {}): IAuthContext {
  return {
    user: null,
    isLoading: false,
    setSettings: vi.fn(),
    signUp: vi.fn().mockResolvedValue(undefined),
    signIn: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn(),
    verifyEmail: vi.fn().mockResolvedValue({ returnPath: null, email: '' }),
    changeEmail: vi.fn().mockResolvedValue(undefined),
    verifyCode: vi.fn().mockResolvedValue({ returnPath: null }),
    redeemCode: vi.fn().mockResolvedValue({ returnPath: null }),
    deleteAccount: vi.fn().mockResolvedValue(undefined),
    setDisplayName: vi.fn(),
    setWhatsappNumber: vi.fn(),
    setHasPassword: vi.fn(),
    ...overrides,
  };
}

export function renderWithAuth(ui: ReactNode, auth: IAuthContext = makeAuth()): ReturnType<typeof render> {
  return render(<AuthContext.Provider value={auth}>{ui}</AuthContext.Provider>);
}

/** A `matchMedia` that reports the given width as a phone (under 720 px) or not. */
export function stubViewport(isPhone: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string): MediaQueryList =>
      ({
        matches: isPhone && query.includes('max-width: 719px'),
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  });
}

/** The JSON a stubbed `fetch` answers with. */
export function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}
