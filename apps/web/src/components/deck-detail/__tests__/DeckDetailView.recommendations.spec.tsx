import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { IDeckDetailResponse, IDeckDetailSnapshot } from '../../../api/deck-detail';
import { breakdown, entry } from './deckDetailTestData';

vi.mock('../DeckHeroBanner', () => ({ DeckHeroBanner: () => <div data-testid="hero-banner" /> }));
vi.mock('../TagChipRow', () => ({ TagChipRow: () => <div data-testid="tag-row" /> }));
vi.mock('../DeckStatusStrip', () => ({ DeckStatusStrip: () => <div data-testid="status-strip" /> }));
vi.mock('../DeckAnalysisRow', () => ({ DeckAnalysisRow: () => <div data-testid="analysis-row" /> }));
vi.mock('../DeckList', () => ({ DeckList: () => <div data-testid="deck-list" /> }));
vi.mock('../MissingPanel', () => ({ MissingPanel: () => <section data-testid="missing-panel" /> }));
vi.mock('../SwapsPanel', () => ({ SwapsPanel: () => <section data-testid="deck-swaps-panel" /> }));
vi.mock('../RecommendationsPanel', () => ({
  RecommendationsPanel: ({ deckCards }: { deckCards: unknown[] }) => (
    <section data-testid="recommendations-panel" data-cards={deckCards.length} />
  ),
}));

import { DeckDetailView } from '../DeckDetailView';

const DECK = {
  id: 7,
  fabraryUlid: null,
  name: 'Katsu',
  hero: 'Katsu, the Wanderer',
  heroIdentifier: 'katsu-the-wanderer',
  format: 'Classic Constructed',
  status: 'building',
  tags: [],
  notes: null,
  trackedAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
  totalCards: 4,
  latestSnapshot: null,
  shoppingLine: null,
  legality: { category: 'legal', reasons: [] },
  replacements: [],
} as unknown as IDeckDetailResponse;

function snapshot(pct: number, missing: boolean): IDeckDetailSnapshot {
  const flex = entry({ cardIdentifier: 'flex-red', name: 'Flex', quantity: 2 });
  return {
    id: 1,
    rawPercent: pct,
    effectivePercent: pct,
    fidelityPercent: pct,
    path: missing ? 'C' : 'A',
    computedAt: '2026-10-01T00:00:00Z',
    breakdown: missing ? breakdown({ missing: [flex] }) : breakdown({ exact: [flex] }),
  } as IDeckDetailSnapshot;
}

function renderView(pct: number, missing: boolean): void {
  const noop = vi.fn();
  render(
    <DeckDetailView
      deck={DECK}
      snapshot={snapshot(pct, missing)}
      tags={[]}
      shoppingData={null}
      onEdit={noop}
      onEditCards={noop}
      onMarkOwned={noop}
      isMarkingOwned={false}
      pendingCard={null}
      deckSwaps={[]}
      pendingSwapId={null}
      onApproveSwap={noop}
      onRejectSwap={noop}
      onUndoSwap={noop}
      onClearRejections={noop}
      isClearingRejections={false}
      onFetchVariants={noop}
      fetchMutationStatus="idle"
      isCooldownActive={false}
      onPollingChange={noop}
      onShoppingRetry={noop}
    />,
  );
}

describe('DeckDetailView recommendations placement', () => {
  it('places the panel under swaps or alone', () => {
    renderView(50, true);
    const panels = screen.getByTestId('deck-action-panels');
    const swaps = within(panels).getByTestId('deck-swaps-panel');
    const recommendations = within(panels).getByTestId('recommendations-panel');
    expect(swaps.parentElement).toBe(recommendations.parentElement);
    expect(swaps.compareDocumentPosition(recommendations) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(panels).getByTestId('missing-panel').parentElement).not.toBe(recommendations.parentElement);
    expect(screen.queryByTestId('deck-recommendations-row')).toBeNull();
    document.body.innerHTML = '';

    renderView(100, false);
    expect(screen.queryByTestId('deck-action-panels')).toBeNull();
    expect(screen.queryByTestId('missing-panel')).toBeNull();
    expect(screen.queryByTestId('deck-swaps-panel')).toBeNull();
    const row = screen.getByTestId('deck-recommendations-row');
    expect(row.children).toHaveLength(1);
    expect(within(row).getByTestId('recommendations-panel')).toHaveAttribute('data-cards', '1');
  });
});
