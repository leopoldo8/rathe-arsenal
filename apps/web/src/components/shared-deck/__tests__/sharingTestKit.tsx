import React from 'react';
import { vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { AuthContext, type IAuthContext, type IAuthUser } from '../../../auth/AuthContext';
import { AuthFetchError } from '../../../lib/auth-fetch';

/** Shared helpers of the sharing specs: a routed fake API on top of a mocked `authFetch`. */

export type TFakeHandler = (call: { method: string; body: unknown; authToken: string | null }) => unknown;

export interface IFakeApi {
  readonly handlers: Map<string, TFakeHandler>;
  readonly calls: { readonly key: string; readonly body: unknown; readonly authToken: string | null }[];
  readonly authFetch: (path: string, init?: RequestInit, token?: string | null) => Promise<unknown>;
}

export function createFakeApi(): IFakeApi {
  const handlers = new Map<string, TFakeHandler>();
  const calls: IFakeApi['calls'] = [] as unknown as IFakeApi['calls'];
  const authFetch: IFakeApi['authFetch'] = async (path, init = {}, token = null) => {
    const method = init.method ?? 'GET';
    const key = `${method} ${path}`;
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
    (calls as { key: string; body: unknown; authToken: string | null }[]).push({ key, body, authToken: token });
    const handler = handlers.get(key);
    if (handler === undefined) throw new Error(`Unhandled fake API call: ${key}`);
    return handler({ method, body, authToken: token });
  };
  return { handlers, calls, authFetch: vi.fn(authFetch) };
}

export function apiError(status: number, code: string | null): AuthFetchError {
  return new AuthFetchError(code ?? 'error', status, null, code);
}

export const SIGNED_IN_USER: IAuthUser = {
  id: 'u1',
  email: 'hero@rathe.gg',
  role: 'user',
  chatAccess: false,
  displayName: 'Dudu_Pelotas',
};

export function makeAuth(overrides: Partial<IAuthContext> = {}): IAuthContext {
  const noop = async (): Promise<void> => undefined;
  return {
    user: SIGNED_IN_USER,
    token: 'jwt',
    isLoading: false,
    setSettings: vi.fn(),
    signUp: async () => ({}),
    signIn: noop,
    signOut: vi.fn(),
    verifyEmail: noop,
    forgotPassword: noop,
    resetPassword: noop,
    deleteAccount: noop,
    setDisplayName: vi.fn(),
    setWhatsappNumber: vi.fn(),
    ...overrides,
  };
}

export function renderWithProviders(ui: React.ReactElement, auth: IAuthContext = makeAuth()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } });
  return render(
    <AuthContext.Provider value={auth}>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </AuthContext.Provider>,
  );
}
