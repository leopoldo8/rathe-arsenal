/**
 * DeckDetailSkeleton tests — Unit 3 (Plan C)
 *
 * Test plan:
 *  - Happy path: renders a container with role="status" and aria-busy="true".
 *  - Happy path: renders column A (readiness hero placeholder).
 *  - Happy path: renders column B (breakdown placeholders).
 *  - Happy path: renders column C (shopping panel placeholder).
 *  - A11y: aria-label describes loading intent.
 *  - Reduced motion: structural correctness is preserved (shimmer is CSS-layer).
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DeckDetailSkeleton } from '../DeckDetailSkeleton';

describe('DeckDetailSkeleton — happy path', () => {
  it('renders a wrapper with role="status" and aria-busy="true"', () => {
    render(<DeckDetailSkeleton />);
    const wrapper = screen.getByRole('status', { name: /carregando o deck/i });
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveAttribute('aria-busy', 'true');
  });

  it('renders the readiness hero placeholder skeleton', () => {
    render(<DeckDetailSkeleton />);
    const heroSkeleton = screen.getByRole('status', { name: /carregando pontuação de prontidão/i });
    expect(heroSkeleton).toBeInTheDocument();
  });

  it('renders the shopping panel placeholder skeleton', () => {
    render(<DeckDetailSkeleton />);
    const shoppingSkeleton = screen.getByRole('status', { name: /carregando painel de compras/i });
    expect(shoppingSkeleton).toBeInTheDocument();
  });

  it('renders multiple card-row placeholder skeletons for column B', () => {
    render(<DeckDetailSkeleton />);
    const cardRows = screen.getAllByRole('status', { name: /carregando linha de carta/i });
    expect(cardRows.length).toBeGreaterThanOrEqual(2);
  });
});

describe('DeckDetailSkeleton — a11y', () => {
  it('has an accessible label on the outer wrapper', () => {
    render(<DeckDetailSkeleton />);
    expect(
      screen.getByRole('status', { name: /carregando o deck/i }),
    ).toBeInTheDocument();
  });
});

describe('DeckDetailSkeleton — single-column structure (UXUI-07)', () => {
  it('renders the banner, analysis and list sections in that order', () => {
    render(<DeckDetailSkeleton />);
    const sections = ['banner', 'analysis', 'list'].map((name) =>
      screen.getByTestId(`deck-detail-skeleton-${name}`),
    );
    sections.slice(1).forEach((section, index) => {
      const previous = sections[index]!;
      expect(previous.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });

  it('has no sidebar or canvas column', () => {
    render(<DeckDetailSkeleton />);
    expect(screen.queryByTestId('deck-detail-skeleton-sidebar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('deck-detail-skeleton-canvas')).not.toBeInTheDocument();
  });
});
