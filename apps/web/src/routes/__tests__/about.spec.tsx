/**
 * /about route tests — DISC-03
 *
 * Spec ACs covered (P1: Fan-content IP disclaimer surface):
 *  - AC4: `/about` renders a self-contained page containing (a) the
 *    disclaimer and (b) a fan-project context section explaining Rathe
 *    Arsenal is an unofficial fan project.
 *  - Edge case: `/about` renders without redirecting / without any auth
 *    shell wrapper (publicly reachable, works while logged out).
 *
 * The page component is imported directly (not via the router) so the
 * test can render it without a full RouterProvider — same pattern as
 * `routes/__tests__/HomeSkeleton.spec.tsx`.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { setTestLocale } from '../../test/i18n-test-utils';
import { AboutPage } from '../about';

const VERBATIM_EN_DISCLAIMER =
  'Rathe Arsenal is in no way affiliated with Legend Story Studios. Flesh and Blood™, and set names are trademarks of Legend Story Studios®. Characters and names may be protected by copyright.';

// Router mock — Link renders as a plain <a> with href, matching the pattern
// used across other route/component tests (e.g. Footer.spec.tsx).
// `createFileRoute` is stubbed to return the options object as-is, since the
// route registration itself is not under test here (only the AboutPage
// component's rendered output is).
//
// The mock also stamps `data-tsr-link="true"` on the rendered anchor so the
// "back to /home" assertion below can discriminate a real TanStack `<Link>`
// from a hand-written `<a href="/home">` (see Footer.spec.tsx for the same
// pattern applied to AC5/DISC-04).
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    className,
  }: {
    children: React.ReactNode;
    to: string;
    className?: string;
  }) => <a href={to} className={className} data-tsr-link="true">{children}</a>,
  createFileRoute: () => (options: unknown) => options,
}));

describe('/about route (DISC-03)', () => {
  it('renders the localized disclaimer (default pt-BR test locale)', () => {
    render(<AboutPage />);
    expect(screen.getByText(/Flesh and Blood™/)).toBeInTheDocument();
    expect(screen.getByText(/Legend Story Studios®/)).toBeInTheDocument();
  });

  it('renders the verbatim en-US disclaimer when that translation string is used', async () => {
    await setTestLocale('en-US');
    render(<AboutPage />);
    expect(screen.getByText(VERBATIM_EN_DISCLAIMER)).toBeInTheDocument();
  });

  it('renders the fan-project context section', () => {
    render(<AboutPage />);
    expect(
      screen.getByText(/projeto de fã não-oficial/i),
    ).toBeInTheDocument();
  });

  it('renders without any authenticated-shell wrapper (public, self-contained)', () => {
    render(<AboutPage />);
    // AppShell renders a <header role="banner"> (TopBar) and a primary
    // <nav>; a self-contained /about page must include neither.
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('renders a back link to /home via router <Link>, not a bare anchor', () => {
    render(<AboutPage />);
    const backLink = screen.getByRole('link', { name: /voltar para a home/i });
    expect(backLink).toHaveAttribute('href', '/home');
    expect(backLink).toHaveAttribute('data-tsr-link', 'true');
  });
});
