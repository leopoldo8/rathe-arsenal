/**
 * VerifyEmail — error state danger treatment (UXUI-10)
 *
 * Asserts that when email verification fails, the error container
 * uses the `errorBox` CSS class (danger token family) instead of
 * the neutral `infoBox`. Uses a source-file check since the route
 * component depends on live router bindings (Route.useSearch) that
 * are hard to wire in a unit test.
 *
 * UXUI-10 AC1: error container SHALL carry `styles.errorBox` (danger
 * token family) — specifically role="alert" + className={styles.errorBox}.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AuthContext } from '../../auth/AuthContext';
import { AuthFetchError } from '../../lib/auth-fetch';
import { makeAuth, stubViewport } from '../../components/auth/__tests__/accountTestKit';
import { ToastProvider } from '../../components/ui/Toast/ToastProvider';

const mockNavigate = vi.fn();
const mockHistoryPush = vi.fn();
const mockResend = vi.fn();

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    createFileRoute: () => (config: object) => ({ ...config, useSearch: () => ({ token: 'a'.repeat(64) }) }),
    useNavigate: () => mockNavigate,
    useRouter: () => ({ history: { push: mockHistoryPush } }),
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  };
});

vi.mock('../../lib/account-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/account-api')>();
  return { ...actual, resendConfirmation: () => mockResend() };
});

import { VerifyEmailPage } from '../verify-email';

const ROUTES_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

describe('verify-email error state — danger treatment (UXUI-10)', () => {
  it('error branch uses errorBox class (danger token family), not infoBox (UXUI-10 AC1)', () => {
    const src = fs.readFileSync(path.join(ROUTES_DIR, 'verify-email.tsx'), 'utf-8');
    // Should use errorBox for the error state
    expect(src).toContain('styles.errorBox');
    // The error branch element has role="alert" paired with styles.errorBox
    expect(src).toMatch(/role="alert"[^{]*className=\{styles\.errorBox\}|className=\{styles\.errorBox\}[^}]*role="alert"/);
    // Should NOT pair infoBox with role="alert" (infoBox is for neutral states only)
    expect(src).not.toMatch(/role="alert"[^{]*className=\{styles\.infoBox\}/);
  });
});

describe('verify-email pending state — diamond replaced (AUTH §4.3)', () => {
  it('renders the status icon as an empty ring, not a glyph', () => {
    const src = fs.readFileSync(path.join(ROUTES_DIR, 'verify-email.tsx'), 'utf-8');
    expect(src).not.toContain('◆');
    expect(src).toMatch(/<div className=\{styles\.statusIcon\} aria-hidden="true" \/>/);
  });
});

describe('VerifyEmailPage', () => {
  const EMAIL = 'bia.souza@gmail.com';
  const STORED_PAGE = '/d/aB3dE5gH7jK9mN';
  const SIGNED_IN = { id: 'u1', email: EMAIL, role: 'user' as const, chatAccess: false, emailConfirmed: false };

  function renderPage(options: { signedIn: boolean; verifyEmail: ReturnType<typeof vi.fn> }) {
    const auth = makeAuth({ user: options.signedIn ? SIGNED_IN : null, verifyEmail: options.verifyEmail });
    return render(
      <AuthContext.Provider value={auth}>
        <ToastProvider>
          <VerifyEmailPage />
        </ToastProvider>
      </AuthContext.Provider>,
    );
  }

  beforeEach(() => {
    stubViewport(false);
    mockNavigate.mockReset();
    mockHistoryPush.mockReset();
    mockResend.mockReset().mockResolvedValue(undefined);
  });

  it('a confirmation goes to the stored page, signed in or not', async () => {
    const confirmed = vi.fn().mockResolvedValue({ returnPath: STORED_PAGE, email: EMAIL });

    const signedIn = renderPage({ signedIn: true, verifyEmail: confirmed });
    await waitFor(() => expect(mockHistoryPush).toHaveBeenCalledWith(STORED_PAGE));
    expect(await screen.findByText('E-mail confirmado. Agora você pode criar links de compartilhar.')).toBeInTheDocument();
    signedIn.unmount();

    mockHistoryPush.mockReset();
    renderPage({ signedIn: false, verifyEmail: confirmed });
    expect(await screen.findByRole('status')).toHaveTextContent('E-mail confirmado.');
    expect(mockHistoryPush).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/entrar', search: { email: EMAIL, next: STORED_PAGE } });
  });

  it('an expired confirmation offers a new one to the owner', async () => {
    const expired = vi.fn().mockRejectedValue(new AuthFetchError('expired', 410, null, 'TOKEN_EXPIRED'));

    const owner = renderPage({ signedIn: true, verifyEmail: expired });
    expect(await screen.findByText('Este link venceu.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Mandar um novo' }));
    await waitFor(() => expect(mockResend).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/Criar conta de novo/)).not.toBeInTheDocument();
    owner.unmount();

    renderPage({ signedIn: false, verifyEmail: expired });
    expect(await screen.findByText('Este link venceu.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mandar um novo' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Criar conta de novo/)).not.toBeInTheDocument();
  });
});
