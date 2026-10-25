import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { IDeckDetailResponse, IDeckDetailSnapshot } from '../../../api/deck-detail';
import type { IShoppingLinePopulated } from '../../../api/shopping-line';
import { setTestLocale } from '../../../test/i18n-test-utils';
import { breakdown, entry, swap } from './deckDetailTestData';

vi.mock('../../ui/Toast/useToast', () => ({ useToast: () => ({ show: vi.fn() }) }));
vi.mock('../../../auth/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'a@b.com', role: 'user', chatAccess: false } }) }));
vi.mock('../../../lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/api-client')>();
  return { ...actual, useApiClient: () => vi.fn() };
});
vi.mock('../DeckHeroBanner', () => ({ DeckHeroBanner: () => <div data-testid="hero-banner" /> }));
vi.mock('../TagChipRow', () => ({ TagChipRow: () => <div data-testid="tag-row" /> }));
vi.mock('../DeckAnalysisRow', () => ({ DeckAnalysisRow: () => <div data-testid="analysis-row" /> }));
vi.mock('../DeckList', () => ({ DeckList: () => <div data-testid="deck-list" /> }));
vi.mock('../recommendations/RecommendationsRail', () => ({
  RecommendationsRail: () => <section data-testid="recommendations-panel" />,
}));

import { DeckDetailView } from '../DeckDetailView';

const DECK = {
  id: 7,
  fabraryUlid: 'abc123',
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

const SNAPSHOT = {
  id: 1,
  rawPercent: 40,
  effectivePercent: 40,
  fidelityPercent: 70,
  path: 'C',
  computedAt: '2026-10-01T00:00:00Z',
  breakdown: breakdown({
    substituted: [swap({ cardIdentifier: 'gap-a', name: 'Gap A' }, 'sub-a')],
    missing: [entry({ cardIdentifier: 'gap-b', name: 'Gap B' })],
  }),
} as IDeckDetailSnapshot;

const ESTIMATED_SHOPPING: IShoppingLinePopulated = {
  kind: 'populated',
  storeName: 'Cúpula DT',
  storeHostname: 'www.cupuladt.com.br',
  totalCostCents: 4990,
  availableCardCount: 1,
  unavailableCardCount: 0,
  lastFetchedAt: new Date().toISOString(),
  lines: [],
  isEstimated: true,
};

describe('DeckDetailView price lookups', () => {
  it('the deck page has no price fetch button or drawer', async () => {
    await setTestLocale('pt-BR');
    const noop = vi.fn();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <DeckDetailView
          deck={DECK}
          snapshot={SNAPSHOT}
          tags={[]}
          shoppingData={ESTIMATED_SHOPPING}
          onEdit={noop}
          onEditCards={noop}
          onMarkOwned={noop}
          isMarkingOwned={false}
          pendingCard={null}
          onShoppingRetry={noop}
        />
      </QueryClientProvider>,
    );

    expect(screen.getByTestId('missing-store-summary')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /obter preços exatos/i })).toBeNull();
    expect(screen.queryByText(/obter preços exatos/i)).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(Object.keys(import.meta.glob('../../variant-queue/*.tsx'))).toEqual([]);
  });
});
