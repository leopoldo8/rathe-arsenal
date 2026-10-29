import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { IDeckDetailResponse, IDeckDetailSnapshot } from '../../../api/deck-detail';
import { setTestLocale } from '../../../test/i18n-test-utils';
import { breakdown, entry, swap } from './deckDetailTestData';

vi.mock('@tanstack/react-router', async (importOriginal) =>
  (await import('../../../test/router-link-mock')).withLinkMock(await importOriginal<typeof import('@tanstack/react-router')>()),
);
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
vi.mock('../MissingSummaryCard', () => ({ MissingSummaryCard: () => <section data-testid="missing-summary-card" /> }));

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

function renderView(): void {
  const noop = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <DeckDetailView deck={DECK} snapshot={SNAPSHOT} tags={[]} onEdit={noop} onEditCards={noop} />
    </QueryClientProvider>,
  );
}

describe('DeckDetailView price lookups', () => {
  it('the deck page has no price fetch button or drawer', async () => {
    await setTestLocale('pt-BR');
    renderView();

    expect(screen.queryByRole('button', { name: /obter preços exatos/i })).toBeNull();
    expect(screen.queryByText(/obter preços exatos/i)).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(Object.keys(import.meta.glob('../../variant-queue/*.tsx'))).toEqual([]);
  });
});

describe('DeckDetailView what is missing', () => {
  it('the old shopping panels and the group callout are gone', async () => {
    await setTestLocale('pt-BR');
    renderView();

    expect(screen.getByTestId('missing-summary-card')).toBeInTheDocument();
    expect(screen.queryByTestId('deck-action-panels')).toBeNull();
    expect(screen.queryByTestId('deck-missing-panel')).toBeNull();
    expect(screen.queryByTestId('missing-store-summary')).toBeNull();
    expect(screen.queryByTestId('missing-share-callout')).toBeNull();
    expect(screen.queryByTestId('shopping-panel-desktop')).toBeNull();
    expect(screen.queryByTestId('sidebar-shopping-block')).toBeNull();
    expect(screen.queryByText('Pedir nos grupos')).toBeNull();
  });
});
