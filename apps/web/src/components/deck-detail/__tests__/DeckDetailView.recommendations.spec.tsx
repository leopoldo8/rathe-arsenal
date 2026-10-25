import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { IDeckDetailResponse, IDeckDetailSnapshot } from '../../../api/deck-detail';
import { breakdown, entry } from './deckDetailTestData';

vi.mock('../../ui/Toast/useToast', () => ({ useToast: () => ({ show: vi.fn() }) }));
vi.mock('../../../auth/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'a@b.com', role: 'user', chatAccess: false } }) }));
vi.mock('../HeroOutsideFormatPanel', () => ({ HeroOutsideFormatPanel: () => null }));
vi.mock('../RuleChangedNotice', () => ({ RuleChangedNotice: () => null }));
vi.mock('../useOtherFormatVerdicts', () => ({ useOtherFormatVerdicts: () => [] }));
vi.mock('../DeckHeroBanner', () => ({ DeckHeroBanner: () => <div data-testid="hero-banner" /> }));
vi.mock('../DeckShareCard', () => ({ DeckShareCard: () => <div data-testid="share-card" /> }));
vi.mock('../TagChipRow', () => ({ TagChipRow: () => <div data-testid="tag-row" /> }));
vi.mock('../DeckStatusStrip', () => ({ DeckStatusStrip: () => <div data-testid="status-strip" /> }));
vi.mock('../DeckAnalysisRow', () => ({ DeckAnalysisRow: () => <div data-testid="analysis-row" /> }));
vi.mock('../DeckList', () => ({ DeckList: () => <div data-testid="deck-list" /> }));
vi.mock('../MissingPanel', () => ({ MissingPanel: () => <section data-testid="missing-panel" /> }));
vi.mock('../recommendations/RecommendationsRail', () => ({
  RecommendationsRail: ({ deckCards, heroName }: { deckCards: unknown[]; heroName: string }) => (
    <section data-testid="recommendations-panel" data-cards={deckCards.length} data-hero={heroName} />
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
      onFetchVariants={noop}
      fetchMutationStatus="idle"
      isCooldownActive={false}
      onPollingChange={noop}
      onShoppingRetry={noop}
    />,
  );
}

describe('DeckDetailView recommendations placement', () => {
  it('puts recommendations right under the status strip', () => {
    for (const [pct, missing] of [[50, true], [100, false]] as const) {
      renderView(pct, missing);
      const view = screen.getByTestId('deck-detail-view');
      const order = [...view.children].map((child) => child.getAttribute('data-testid'));
      const strip = order.indexOf('status-strip');
      expect(order[strip + 1]).toBe('recommendations-panel');
      expect(order.indexOf('analysis-row')).toBeGreaterThan(strip + 1);
      expect(screen.getAllByTestId('recommendations-panel')).toHaveLength(1);
      expect(screen.getByTestId('recommendations-panel')).toHaveAttribute('data-hero', 'Katsu, the Wanderer');
      expect(screen.getByTestId('recommendations-panel')).toHaveAttribute('data-cards', '1');
      const panels = screen.queryByTestId('deck-action-panels');
      if (missing) expect(within(panels!).queryByTestId('recommendations-panel')).toBeNull();
      else expect(panels).toBeNull();
      document.body.innerHTML = '';
    }
  });
});
