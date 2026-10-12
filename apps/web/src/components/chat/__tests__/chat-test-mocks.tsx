import React from 'react';
import { vi } from 'vitest';

export const mockApiFetch = vi.fn();
export const mockNavigate = vi.fn();

type TParams = Readonly<Record<string, string | number>>;

function resolvePath(to: string, params?: TParams, search?: Readonly<Record<string, unknown>>): string {
  const path = Object.entries(params ?? {}).reduce((acc, [key, value]) => acc.replace(`$${key}`, String(value)), to);
  const query = new URLSearchParams(
    Object.entries(search ?? {}).flatMap(([key, value]) => (value === undefined ? [] : [[key, String(value)]])),
  ).toString();
  return query ? `${path}?${query}` : path;
}

export const routerMock = {
  Link: ({
    to,
    params,
    search,
    children,
    activeProps: _activeProps,
    ...rest
  }: {
    to: string;
    params?: TParams;
    search?: Readonly<Record<string, unknown>>;
    children?: React.ReactNode;
    activeProps?: unknown;
    [key: string]: unknown;
  }) => (
    <a href={resolvePath(to, params, search)} {...rest}>
      {children}
    </a>
  ),
  useNavigate: () => mockNavigate,
  Navigate: ({ to }: { to: string }) => <div data-testid="navigate" data-to={to} />,
};

export function navigatedTo(): string | null {
  const call = mockNavigate.mock.calls.at(-1)?.[0] as { to: string; params?: TParams; search?: Record<string, unknown> } | undefined;
  return call ? resolvePath(call.to, call.params, call.search) : null;
}

