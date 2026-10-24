import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import { AuthProvider } from '../AuthProvider';
import { useAuth } from '../useAuth';
import type { IAuthContext } from '../AuthContext';
import { notifyUnauthorized } from '../../lib/session-events';

const mockAuthFetch = vi.fn();
vi.mock('../../lib/auth-fetch', () => ({
  authFetch: (...args: unknown[]) => mockAuthFetch(...args),
  AuthFetchError: class AuthFetchError extends Error {},
}));

const LEGACY_KEY = 'rathe-arsenal:jwt';
const ME = { id: 'u1', email: 'a@b.com', role: 'user', chatAccess: false, settings: { theme: 'dark' } };

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

afterEach(() => {
  localStorage.clear();
});

describe('AuthProvider session (door 17)', () => {
  it('the provider drops the old key and asks me who is signed in', async () => {
    localStorage.setItem(LEGACY_KEY, 'a-jwt-from-before');
    mockAuthFetch.mockResolvedValue(ME);
    const view = capture();

    render(<AuthProvider><view.Probe /></AuthProvider>);

    await waitFor(() => expect(view.current!.user?.email).toBe('a@b.com'));
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
    expect(mockAuthFetch).toHaveBeenCalledWith('/auth/me');
    expect(view.current!.restoredSession).toBe(true);
    expect(view.current!.isLoading).toBe(false);
  });

  it('treats a 401 from /auth/me as signed out', async () => {
    mockAuthFetch.mockRejectedValue(Object.assign(new Error('Unauthorized'), { status: 401 }));
    const view = capture();

    render(<AuthProvider><view.Probe /></AuthProvider>);

    await waitFor(() => expect(view.current!.isLoading).toBe(false));
    expect(view.current!.user).toBeNull();
    expect(view.current!.restoredSession).toBeUndefined();
  });

  it('opens the sign-in sheet state only for a player who was signed in', async () => {
    mockAuthFetch.mockResolvedValue(ME);
    const signedIn = capture();
    const first = render(<AuthProvider><signedIn.Probe /></AuthProvider>);
    await waitFor(() => expect(signedIn.current!.user).not.toBeNull());

    act(() => notifyUnauthorized());
    expect(signedIn.current!.sessionEnded).toBe(true);
    expect(signedIn.current!.user).not.toBeNull();
    first.unmount();

    mockAuthFetch.mockRejectedValue(new Error('401'));
    const anonymous = capture();
    render(<AuthProvider><anonymous.Probe /></AuthProvider>);
    await waitFor(() => expect(anonymous.current!.isLoading).toBe(false));
    act(() => notifyUnauthorized());
    expect(anonymous.current!.sessionEnded).toBeUndefined();
  });

  it('"Sair" asks the server to end the session and clears this device', async () => {
    mockAuthFetch.mockImplementation(async (path: string) => (path === '/auth/me' ? ME : undefined));
    const view = capture();
    render(<AuthProvider><view.Probe /></AuthProvider>);
    await waitFor(() => expect(view.current!.user).not.toBeNull());

    act(() => view.current!.signOut());

    await waitFor(() => expect(view.current!.user).toBeNull());
    expect(mockAuthFetch).toHaveBeenCalledWith('/auth/sign-out', { method: 'POST' });
  });
});
