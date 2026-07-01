/**
 * Footer tests — DISC-01
 *
 * Spec ACs covered (P1: Fan-content IP disclaimer surface):
 *  - AC1: AppShell renders a persistent footer containing the localized
 *    disclaimer text and a link to /about (asserted at the AppShell level
 *    is out of scope here — this file covers the Footer component itself).
 *  - AC2: en-US locale renders the verbatim disclaimer string.
 *  - AC3: pt-BR locale renders a pt-BR translation preserving the
 *    trademark substrings.
 *  - AC5: the /about link uses the TanStack Router <Link> (SPA navigation),
 *    not a bare anchor full-reload.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { setTestLocale } from '../../../test/i18n-test-utils';
import { Footer } from '../Footer';

const VERBATIM_EN_DISCLAIMER =
  'Rathe Arsenal is in no way affiliated with Legend Story Studios. Flesh and Blood™, and set names are trademarks of Legend Story Studios®. Characters and names may be protected by copyright.';

// ---------------------------------------------------------------------------
// Router mock — Link renders as a plain <a> with href so href-based
// assertions can confirm SPA navigation (not a bare anchor) without a full
// RouterProvider, matching the pattern used across other shell/route tests.
// ---------------------------------------------------------------------------
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    className,
  }: {
    children: React.ReactNode;
    to: string;
    className?: string;
  }) => <a href={to} className={className}>{children}</a>,
}));

describe('Footer', () => {
  // Local locale switches are auto-reverted by the global beforeEach in
  // setup.ts (resets to pt-BR before every test) — no local afterEach needed.

  it('renders the verbatim en-US disclaimer text', async () => {
    await setTestLocale('en-US');
    render(<Footer />);
    expect(screen.getByText(VERBATIM_EN_DISCLAIMER)).toBeInTheDocument();
  });

  it('renders the localized pt-BR disclaimer text', async () => {
    await setTestLocale('pt-BR');
    render(<Footer />);
    expect(screen.getByText(/Flesh and Blood™/)).toBeInTheDocument();
    expect(screen.getByText(/Legend Story Studios®/)).toBeInTheDocument();
    expect(screen.getByText(/A Rathe Arsenal não tem nenhuma afiliação/)).toBeInTheDocument();
  });

  it('renders the /about link via router <Link> (href, not a bare full-reload anchor)', async () => {
    await setTestLocale('en-US');
    render(<Footer />);
    const aboutLink = screen.getByRole('link', { name: 'About' });
    expect(aboutLink).toHaveAttribute('href', '/about');
  });
});
