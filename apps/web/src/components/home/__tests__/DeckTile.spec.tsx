import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DeckTile } from '../DeckTile';
import type { ITrackedDeckListItem } from '../../../api/decks';
import { ToastProvider } from '../../ui/Toast/ToastProvider';
import styles from '../DeckTile.module.css';

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    Link: ({
      children,
      to,
      params,
      className,
      'aria-label': ariaLabel,
      'data-testid': testId,
    }: {
      children: React.ReactNode;
      to: string;
      params?: Record<string, string>;
      className?: string;
      'aria-label'?: string;
      'data-testid'?: string;
    }) => (
      <a
        href={params ? to.replace('$deckId', params.deckId ?? '') : to}
        className={className}
        aria-label={ariaLabel}
        data-testid={testId}
      >
        {children}
      </a>
    ),
  };
});

function makeDeck(overrides: Partial<ITrackedDeckListItem> = {}): ITrackedDeckListItem {
  return {
    id: 7,
    fabraryUlid: 'ulid',
    name: 'Rhinar Aggro',
    hero: 'Rhinar',
    format: 'Classic Constructed',
    trackedAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    status: 'building',
    tags: [],
    legality: { category: 'legal', reasons: [] },
    latestSnapshot: { rawPercent: 94, effectivePercent: 94, computedAt: '' },
    heroImageUrl: null,
    representativeCards: [],
    cardCounts: { owned: 63, missing: 4, total: 67 },
    ...overrides,
  };
}

function renderTile(deck: ITrackedDeckListItem, onUntrack = vi.fn(), isUntracking = false) {
  return render(
    <ToastProvider>
      <DeckTile deck={deck} onUntrack={onUntrack} isUntracking={isUntracking} />
    </ToastProvider>,
  );
}

describe('DeckTile', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  describe('meta line (HOME-06)', () => {
    it('reads completed with owned/total and the ready tone at 100 percent', () => {
      renderTile(
        makeDeck({
          latestSnapshot: { rawPercent: 100, effectivePercent: 100, computedAt: '' },
          cardCounts: { owned: 67, missing: 0, total: 67 },
        }),
      );
      const meta = screen.getByTestId('deck-meta');
      expect(meta).toHaveTextContent('Completo · 67/67');
      expect(meta).toHaveAttribute('data-state', 'complete');
      expect(meta).toHaveClass(styles.metaComplete as string);
    });

    it('reads missing count with owned/total and the warn tone when incomplete', () => {
      renderTile(makeDeck());
      const meta = screen.getByTestId('deck-meta');
      expect(meta).toHaveTextContent('4 faltando · 63/67');
      expect(meta).toHaveAttribute('data-state', 'incomplete');
      expect(meta).toHaveClass(styles.metaIncomplete as string);
    });

    it('reads the draft label in the muted tone when the deck has no card list', () => {
      renderTile(makeDeck({ latestSnapshot: null, cardCounts: null }));
      const meta = screen.getByTestId('deck-meta');
      expect(meta).toHaveTextContent('Rascunho · sem lista');
      expect(meta).toHaveAttribute('data-state', 'draft');
      expect(meta).toHaveClass(styles.metaDraft as string);
    });

    it('applies the state class to one state only', () => {
      renderTile(makeDeck());
      const meta = screen.getByTestId('deck-meta');
      expect(meta).not.toHaveClass(styles.metaComplete as string);
      expect(meta).not.toHaveClass(styles.metaDraft as string);
    });
  });

  describe('legality marker is exception-based', () => {
    it('shows the marker for an illegal deck', () => {
      renderTile(makeDeck({ legality: { category: 'illegal', reasons: ['x'] } }));
      const marker = screen.getByTestId('legality-illegal');
      expect(marker).toHaveClass(styles.legalityIllegal as string);
      expect(marker).toHaveAttribute('aria-label', 'Fora do formato');
    });

    it('shows nothing for a legal deck', () => {
      renderTile(makeDeck({ legality: { category: 'legal', reasons: [] } }));
      expect(screen.queryByTestId('legality-illegal')).not.toBeInTheDocument();
    });

    it('shows nothing for an incomplete-but-legal deck', () => {
      renderTile(makeDeck({ legality: { category: 'incomplete', reasons: ['x'] } }));
      expect(screen.queryByTestId('legality-illegal')).not.toBeInTheDocument();
    });
  });

  describe('deckbox composition', () => {
    it('links the deckbox to the deck detail', () => {
      renderTile(makeDeck());
      expect(screen.getByTestId('deckbox')).toHaveAttribute('href', '/decks/7');
    });

    it('embeds the readiness medallion with the effective percent', () => {
      renderTile(makeDeck());
      expect(screen.getByTestId('readiness-medallion')).toHaveAttribute('aria-valuenow', '94');
    });

    it('omits the medallion for a draft', () => {
      renderTile(makeDeck({ latestSnapshot: null, cardCounts: null }));
      expect(screen.queryByTestId('readiness-medallion')).not.toBeInTheDocument();
    });

    it('renders the three card slots', () => {
      renderTile(makeDeck());
      expect(screen.getAllByTestId('deckbox-card')).toHaveLength(3);
    });

    it('drops the old life-token meter', () => {
      renderTile(makeDeck());
      expect(screen.queryByRole('meter', { name: /prontidão \d+%/i })).not.toBeInTheDocument();
    });
  });

  describe('untrack pin', () => {
    it('sits beside the deckbox link, not inside it', () => {
      renderTile(makeDeck());
      const pin = screen.getByRole('button', { name: /excluir rhinar aggro/i });
      expect(screen.getByTestId('deckbox').contains(pin)).toBe(false);
      expect(pin).toHaveClass(styles.untrackPin as string);
    });

    it('is disabled while the untrack mutation runs', () => {
      renderTile(makeDeck(), vi.fn(), true);
      expect(screen.getByRole('button', { name: /excluir rhinar aggro/i })).toBeDisabled();
    });

    it('hides the tile immediately on click', () => {
      renderTile(makeDeck());
      fireEvent.click(screen.getByRole('button', { name: /excluir rhinar aggro/i }));
      expect(screen.queryByTestId('deckbox')).not.toBeInTheDocument();
    });

    it('calls onUntrack only after the undo window', () => {
      const onUntrack = vi.fn();
      renderTile(makeDeck(), onUntrack);
      fireEvent.click(screen.getByRole('button', { name: /excluir rhinar aggro/i }));
      act(() => vi.advanceTimersByTime(4799));
      expect(onUntrack).not.toHaveBeenCalled();
      act(() => vi.advanceTimersByTime(1));
      expect(onUntrack).toHaveBeenCalledWith(7);
    });

    it('undo restores the tile and never calls onUntrack', () => {
      const onUntrack = vi.fn();
      renderTile(makeDeck(), onUntrack);
      fireEvent.click(screen.getByRole('button', { name: /excluir rhinar aggro/i }));
      fireEvent.click(screen.getByRole('button', { name: /desfazer/i }));
      act(() => vi.advanceTimersByTime(10000));
      expect(onUntrack).not.toHaveBeenCalled();
      expect(screen.getByTestId('deckbox')).toBeInTheDocument();
    });
  });
});
