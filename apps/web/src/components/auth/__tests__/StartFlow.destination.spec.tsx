import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { jsonResponse, makeAuth, renderWithAuth } from './accountTestKit';

const navigateMock = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, className }: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
  Navigate: () => null,
  useNavigate: () => navigateMock,
  useRouter: () => ({ history: { push: vi.fn(), replace: vi.fn() } }),
}));
vi.mock('../../ui/Toast/useToast', () => ({ useToast: () => ({ show: vi.fn() }) }));

import { StartFlow } from '../StartFlow';

const EMAIL = 'lucas.prado@hotmail.com';

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('StartFlow destination (C179)', () => {
  it('an account that signs in later lands on /home, not on the first-run screen', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ next: 'password' })));
    const auth = makeAuth();
    renderWithAuth(<StartFlow />, auth);

    await userEvent.type(screen.getByLabelText('Seu e-mail'), EMAIL);
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await userEvent.type(await screen.findByLabelText('Senha'), 'my-long-password');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith({ to: '/home', search: { tag: [] } }));
    expect(navigateMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).not.toHaveBeenCalledWith({ to: '/onboarding' });
  });
});
