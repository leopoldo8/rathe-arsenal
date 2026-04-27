/**
 * DeckDetailEmptyState tests — Unit 3 (Plan C)
 *
 * Test plan:
 *  - kind="not-found": heading, body, primary CTA link (→ /home),
 *    secondary CTA link (→ /add-cards/fabrary).
 *  - kind="computing": heading, body text, no CTA links, inline skeleton present.
 *  - A11y: each variant has a labelled heading.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DeckDetailEmptyState } from '../DeckDetailEmptyState';

// TanStack Router Link renders an <a> in tests when mocked with href passthrough.
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    children,
    className,
  }: {
    to: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

// ---------------------------------------------------------------------------
// kind="not-found"
// ---------------------------------------------------------------------------

describe('DeckDetailEmptyState — kind="not-found"', () => {
  it('renders the not-found heading', () => {
    render(<DeckDetailEmptyState kind="not-found" />);
    expect(
      screen.getByRole('heading', { name: /this deck isn.t in your arsenal/i }),
    ).toBeInTheDocument();
  });

  it('renders the stale-link body copy', () => {
    render(<DeckDetailEmptyState kind="not-found" />);
    expect(screen.getByText(/it may have been removed/i)).toBeInTheDocument();
  });

  it('renders the primary CTA linking to /home', () => {
    render(<DeckDetailEmptyState kind="not-found" />);
    const link = screen.getByRole('link', { name: /back to home/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/home');
  });

  it('renders the secondary CTA linking to /add-cards/fabrary', () => {
    render(<DeckDetailEmptyState kind="not-found" />);
    const link = screen.getByRole('link', { name: /track a fabrary deck/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/add-cards/fabrary');
  });

  it('does NOT render a computing skeleton', () => {
    render(<DeckDetailEmptyState kind="not-found" />);
    // The computing skeleton has aria-label="Computing readiness"
    expect(screen.queryByRole('status', { name: /computing readiness/i })).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// kind="computing"
// ---------------------------------------------------------------------------

describe('DeckDetailEmptyState — kind="computing"', () => {
  it('renders the computing heading', () => {
    render(<DeckDetailEmptyState kind="computing" />);
    expect(
      screen.getByRole('heading', { name: /computing readiness/i }),
    ).toBeInTheDocument();
  });

  it('renders the wait-a-few-seconds body copy', () => {
    render(<DeckDetailEmptyState kind="computing" />);
    expect(screen.getByText(/this takes a few seconds/i)).toBeInTheDocument();
  });

  it('renders the inline skeleton placeholder', () => {
    render(<DeckDetailEmptyState kind="computing" />);
    expect(
      screen.getByRole('status', { name: /computing readiness/i }),
    ).toBeInTheDocument();
  });

  it('does NOT render any CTA links', () => {
    render(<DeckDetailEmptyState kind="computing" />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// A11y
// ---------------------------------------------------------------------------

describe('DeckDetailEmptyState — a11y', () => {
  it('not-found variant has a landmark with accessible name', () => {
    render(<DeckDetailEmptyState kind="not-found" />);
    expect(
      screen.getByRole('region', { name: /this deck isn.t in your arsenal/i }),
    ).toBeInTheDocument();
  });

  it('computing variant has a landmark with accessible name', () => {
    render(<DeckDetailEmptyState kind="computing" />);
    expect(
      screen.getByRole('region', { name: /computing readiness/i }),
    ).toBeInTheDocument();
  });
});
