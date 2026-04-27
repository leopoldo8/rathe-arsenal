/**
 * BottomTabBar tests — Unit 9
 *
 * Covers:
 *  - Happy path: 3 tab items (Home / Library / Reviews), no Import
 *  - A11y: mobile nav has correct aria-label
 *  - No /import data-to attribute
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// --- Mocks ---

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    children,
    ...rest
  }: {
    to: string;
    children: React.ReactNode;
    [k: string]: unknown;
  }) => (
    <a href={to} data-to={to} {...rest}>
      {children}
    </a>
  ),
  useRouterState: ({
    select,
  }: {
    select?: (s: { location: { pathname: string } }) => unknown;
  } = {}) => {
    const state = { location: { pathname: '/home' } };
    if (typeof select === 'function') return select(state);
    return state;
  },
}));

import { BottomTabBar } from '../BottomTabBar';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BottomTabBar — tab items', () => {
  it('renders exactly 3 tab links', () => {
    render(<BottomTabBar />);
    const nav = screen.getByRole('navigation', { name: 'Mobile primary' });
    const links = nav.querySelectorAll('a');
    expect(links).toHaveLength(3);
  });

  it('renders the Home tab', () => {
    render(<BottomTabBar />);
    expect(screen.getByText('Home')).toBeInTheDocument();
  });

  it('renders the Library tab', () => {
    render(<BottomTabBar />);
    expect(screen.getByText('Library')).toBeInTheDocument();
  });

  it('renders the Reviews tab', () => {
    render(<BottomTabBar />);
    expect(screen.getByText('Reviews')).toBeInTheDocument();
  });

  it('does not render an Import tab', () => {
    render(<BottomTabBar />);
    expect(screen.queryByText('Import')).not.toBeInTheDocument();
  });

  it('does not render a link to /import', () => {
    render(<BottomTabBar />);
    const nav = screen.getByRole('navigation', { name: 'Mobile primary' });
    const importLinks = nav.querySelectorAll('[data-to="/import"]');
    expect(importLinks).toHaveLength(0);
  });
});

describe('BottomTabBar — A11y', () => {
  it('has aria-label="Mobile primary"', () => {
    render(<BottomTabBar />);
    expect(
      screen.getByRole('navigation', { name: 'Mobile primary' }),
    ).toBeInTheDocument();
  });
});
