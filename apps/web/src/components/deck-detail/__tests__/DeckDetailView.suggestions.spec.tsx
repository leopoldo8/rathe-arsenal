import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { IDeckDetailResponse, IDeckDetailSnapshot } from '../../../api/deck-detail';
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

describe('DeckDetailView without swaps', () => {
  it('shows no swaps panel, banner or link', async () => {
    await setTestLocale('pt-BR');
    const noop = vi.fn();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <DeckDetailView
          deck={DECK}
          snapshot={SNAPSHOT}
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
        />
      </QueryClientProvider>,
    );

    expect(screen.getByTestId('deck-status-strip')).toHaveAttribute('data-kind', 'suggestions');
    expect(screen.getByTestId('deck-missing-panel')).toBeInTheDocument();
    expect(screen.getByTestId('missing-row-suggestion')).toHaveTextContent('Sub sub-a');
    expect(screen.queryByTestId('deck-swaps-panel')).toBeNull();
    expect(screen.queryByText(/trocas recusadas/i)).toBeNull();
    expect(screen.queryByText('Ver trocas')).toBeNull();
    expect(document.querySelector('a[href^="/swaps"]')).toBeNull();
  });
});
