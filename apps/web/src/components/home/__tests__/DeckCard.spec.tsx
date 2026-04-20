import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeckCard } from '../DeckCard';
import { ITrackedDeckListItem } from '../../../api/decks';

// ---------------------------------------------------------------------------
// Mock TanStack Router — Link renders as a plain <a> so tests don't need
// a full RouterProvider.
// ---------------------------------------------------------------------------

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    Link: ({
      children,
      to,
      params,
      className,
    }: {
      children: React.ReactNode;
      to: string;
      params?: Record<string, string>;
      className?: string;
    }) => {
      const href = params ? to.replace('$deckId', params.deckId ?? '') : to;
      return (
        <a href={href} className={className}>
          {children}
        </a>
      );
    },
  };
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeDeck(overrides: Partial<ITrackedDeckListItem> = {}): ITrackedDeckListItem {
  return {
    id: 1,
    fabraryUlid: 'test-ulid',
    name: 'Test Deck',
    hero: 'Rhinar',
    format: 'Classic Constructed',
    trackedAt: '2026-01-01T00:00:00Z',
    latestSnapshot: {
      rawPercent: 85,
      effectivePercent: 85,
      computedAt: '2026-01-01T00:00:00Z',
    },
    ...overrides,
  };
}

function renderDeckCard(
  deck: ITrackedDeckListItem,
  onUntrack = vi.fn(),
  isUntracking = false,
) {
  return render(
    <DeckCard deck={deck} onUntrack={onUntrack} isUntracking={isUntracking} />,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DeckCard', () => {
  beforeEach(() => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
  });

  it('renders deck name', () => {
    renderDeckCard(makeDeck({ name: 'Prism Spectral Shield' }));
    expect(screen.getByText('Prism Spectral Shield')).toBeInTheDocument();
  });

  it('renders hero and format', () => {
    renderDeckCard(makeDeck({ hero: 'Prism', format: 'Blitz' }));
    expect(screen.getByText(/Prism/)).toBeInTheDocument();
    expect(screen.getByText(/Blitz/)).toBeInTheDocument();
  });

  it('renders effectivePercent with .ra-readiness-display class', () => {
    renderDeckCard(
      makeDeck({
        latestSnapshot: { rawPercent: 85, effectivePercent: 85, computedAt: '' },
      }),
    );
    const pctEl = screen.getByText(/85\.0%/);
    expect(pctEl).toHaveClass('ra-readiness-display');
  });

  it('renders "No readiness data yet" when snapshot is null', () => {
    renderDeckCard(makeDeck({ latestSnapshot: null }));
    expect(screen.getByText(/no readiness data yet/i)).toBeInTheDocument();
  });

  it('calls onUntrack with deck.id after confirm', () => {
    const onUntrack = vi.fn();
    renderDeckCard(makeDeck({ id: 42 }), onUntrack);
    const buttons = screen.getAllByRole('button', { name: /untrack/i });
    const firstButton = buttons[0];
    expect(firstButton).toBeDefined();
    fireEvent.click(firstButton!);
    expect(onUntrack).toHaveBeenCalledWith(42);
  });

  it('does not call onUntrack when confirm is cancelled', () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(false));
    const onUntrack = vi.fn();
    renderDeckCard(makeDeck());
    const buttons = screen.getAllByRole('button', { name: /untrack/i });
    const firstButton = buttons[0];
    expect(firstButton).toBeDefined();
    fireEvent.click(firstButton!);
    expect(onUntrack).not.toHaveBeenCalled();
  });

  it('shows loading state when isUntracking=true', () => {
    renderDeckCard(makeDeck(), vi.fn(), true);
    const buttons = screen.getAllByRole('button');
    const disabledOrLoading = buttons.filter(
      (b) =>
        b.getAttribute('aria-busy') === 'true' ||
        b.getAttribute('aria-disabled') === 'true',
    );
    expect(disabledOrLoading.length).toBeGreaterThan(0);
  });

  it('renders View link to deck detail', () => {
    renderDeckCard(makeDeck({ id: 7 }));
    const viewLinks = screen.getAllByRole('link', { name: /view/i });
    expect(viewLinks.length).toBeGreaterThan(0);
    expect(viewLinks[0]).toHaveAttribute('href', '/decks/7');
  });
});
