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

const STORAGE_KEY = 'rathe-arsenal:jwt';

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

describe('AuthProvider chat access', () => {
  it('chatAccess follows the auth responses', async () => {
    // sign-in response with chatAccess: true
    mockAuthFetch.mockResolvedValueOnce({
      jwt: 'jwt-1',
      user: { id: 'u1', email: 'a@b.com', role: 'user', chatAccess: true },
      settings: { theme: 'dark' },
    });
    const signedIn = capture();
    const first = render(<AuthProvider><signedIn.Probe /></AuthProvider>);
    await act(async () => {
      await signedIn.current!.signIn('a@b.com', 'longenoughpassword');
    });
    expect(signedIn.current!.user?.chatAccess).toBe(true);
    first.unmount();

    // verify-email and reset-password responses
    localStorage.clear();
    const viaToken = capture();
    const tokenView = render(<AuthProvider><viaToken.Probe /></AuthProvider>);
    mockAuthFetch.mockResolvedValueOnce({ jwt: 'jwt-v', user: { id: 'u4', email: 'g@h.com', role: 'user', chatAccess: true }, settings: { theme: 'dark' } });
    await act(async () => {
      await viaToken.current!.verifyEmail('t'.repeat(64));
    });
    const afterVerify = viaToken.current!.user?.chatAccess;
    mockAuthFetch.mockResolvedValueOnce({ jwt: 'jwt-r', user: { id: 'u4', email: 'g@h.com', role: 'user', chatAccess: false }, settings: { theme: 'dark' } });
    await act(async () => {
      await viaToken.current!.resetPassword('t'.repeat(64), 'newpasswordlongenough');
    });
    expect([afterVerify, viaToken.current!.user?.chatAccess]).toEqual([true, false]);
    tokenView.unmount();
    localStorage.clear();

    // /auth/me with chatAccess: true
    localStorage.setItem(STORAGE_KEY, 'jwt-2');
    mockAuthFetch.mockResolvedValueOnce({ id: 'u2', email: 'c@d.com', role: 'user', chatAccess: true, settings: { theme: 'dark' } });
    const granted = capture();
    const second = render(<AuthProvider><granted.Probe /></AuthProvider>);
    await waitFor(() => expect(granted.current!.user).not.toBeNull());
    expect(granted.current!.user?.chatAccess).toBe(true);
    second.unmount();

    // /auth/me from a server that does not send the field
    localStorage.setItem(STORAGE_KEY, 'jwt-3');
    mockAuthFetch.mockResolvedValueOnce({ id: 'u3', email: 'e@f.com', role: 'user', settings: { theme: 'dark' } });
    const older = capture();
    render(<AuthProvider><older.Probe /></AuthProvider>);
    await waitFor(() => expect(older.current!.user).not.toBeNull());
    expect(older.current!.user?.chatAccess).toBe(false);
  });
});
