import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { AuthProvider } from '../AuthProvider';
import { useAuth } from '../useAuth';
import type { IAuthContext } from '../AuthContext';

const mockAuthFetch = vi.fn();
vi.mock('../../lib/auth-fetch', () => ({
  authFetch: (...args: unknown[]) => mockAuthFetch(...args),
  AuthFetchError: class AuthFetchError extends Error {},
}));

function capture(): { current: IAuthContext | null; Probe: () => null } {
  const ref: { current: IAuthContext | null; Probe: () => null } = {
    current: null,
    Probe: () => {
      ref.current = useAuth();
      return null;
    },
  };
  return ref;
}

beforeEach(() => {
  mockAuthFetch.mockReset();
  localStorage.clear();
});

/** Answers each auth route by path; the bootstrap `/auth/me` answers 401 (signed out) unless `/auth/me` is among the routes. */
function answer(routes: Record<string, unknown>): void {
  mockAuthFetch.mockImplementation(async (path: string) => {
    if (path in routes) return routes[path];
    throw new Error('401');
  });
}

describe('AuthProvider chat access', () => {
  it('chatAccess follows the auth responses', async () => {
    // sign-in response with chatAccess: true
    answer({
      '/auth/sign-in': {
        user: { id: 'u1', email: 'a@b.com', role: 'user', chatAccess: true },
        settings: { theme: 'dark' },
      },
    });
    const signedIn = capture();
    const first = render(<AuthProvider><signedIn.Probe /></AuthProvider>);
    await act(async () => {
      await signedIn.current!.signIn('a@b.com', 'longenoughpassword');
    });
    expect(signedIn.current!.user?.chatAccess).toBe(true);
    first.unmount();

    // code sign-in response
    const viaCode = capture();
    const codeView = render(<AuthProvider><viaCode.Probe /></AuthProvider>);
    answer({
      '/auth/codes/verify': { returnPath: null, user: { id: 'u4', email: 'g@h.com', role: 'user', chatAccess: false }, settings: { theme: 'dark' } },
    });
    await act(async () => {
      await viaCode.current!.verifyCode('g@h.com', '123456');
    });
    expect(viaCode.current!.user?.chatAccess).toBe(false);
    codeView.unmount();

    // /auth/me with chatAccess: true
    answer({ '/auth/me': { id: 'u2', email: 'c@d.com', role: 'user', chatAccess: true, settings: { theme: 'dark' } } });
    const granted = capture();
    const second = render(<AuthProvider><granted.Probe /></AuthProvider>);
    await waitFor(() => expect(granted.current!.user).not.toBeNull());
    expect(granted.current!.user?.chatAccess).toBe(true);
    second.unmount();

    // /auth/me from a server that does not send the field
    answer({ '/auth/me': { id: 'u3', email: 'e@f.com', role: 'user', settings: { theme: 'dark' } } });
    const older = capture();
    render(<AuthProvider><older.Probe /></AuthProvider>);
    await waitFor(() => expect(older.current!.user).not.toBeNull());
    expect(older.current!.user?.chatAccess).toBe(false);
  });
});
