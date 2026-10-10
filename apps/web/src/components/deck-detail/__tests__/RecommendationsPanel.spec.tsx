import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { IRecommendationCard, IRecommendationsResponse } from '../../../api/recommendations';
import { setTestLocale } from '../../../test/i18n-test-utils';

const mockApiFetch = vi.fn();
vi.mock('../../../lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/api-client')>();
  return { ...actual, useApiClient: () => mockApiFetch };
});

const mockShow = vi.fn();
vi.mock('../../ui/Toast/useToast', () => ({ useToast: () => ({ show: mockShow }) }));

import { ApiError } from '../../../lib/api-client';
import { RecommendationsPanel, type IRecommendationDeckCard } from '../RecommendationsPanel';
import { deckDetailQueryKey } from '../../../api/deck-detail';
import { SWAPS_QUERY_KEY } from '../../../api/swaps';
import { enUS } from '../../../i18n/locales/en-US';

const NOTHING_TO_REPLACE_MESSAGE = enUS.recommendations.cutGone;

const DECK_ID = 7;
const BASE = `/decks/${DECK_ID}/recommendations`;

const DECK_CARDS: IRecommendationDeckCard[] = [
  { cardIdentifier: 'flex-red', name: 'Flex', slot: 'mainboard', pitch: 1 },
  { cardIdentifier: 'emissary-of-tides-red', name: 'Emissary of Tides', slot: 'mainboard', pitch: 1 },
  { cardIdentifier: 'talishar-the-lost-prince', name: 'Talishar, the Lost Prince', slot: 'weapon', pitch: null },
  { cardIdentifier: 'arcanite-skullcap', name: 'Arcanite Skullcap', slot: 'equipment', pitch: null },
];

function recommendation(overrides: Partial<IRecommendationCard> = {}): IRecommendationCard {
  return {
    id: 'rec-1',
    rank: 1,
    cardIdentifier: 'adrenaline-rush-red',
    name: 'Adrenaline Rush',
    pitch: 1,
    cost: 0,
    imageUrl: null,
    slot: 'mainboard',
    strength: 'consider',
    reason: 'Pumps the attacks Katsu chains together.',
    cutCardIdentifier: null,
    cutName: null,
    cutPitch: null,
    cutCost: null,
    cutSlot: null,
    freeCopies: 0,
    priceCents: null,
    productUrl: null,
    ...overrides,
  };
}

const RUN = { id: 'run-1', status: 'done' as const, trigger: 'manual' as const, finishedAt: '2026-10-06T10:00:00.000Z', stale: false };

function response(overrides: Partial<IRecommendationsResponse> = {}): IRecommendationsResponse {
  return { run: RUN, pending: false, failure: null, recommendations: [recommendation()], ...overrides };
}

let client: QueryClient;

function renderPanel(): void {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RecommendationsPanel deckId={DECK_ID} deckCards={DECK_CARDS} />
    </QueryClientProvider>,
  );
}

function reads(): number {
  return mockApiFetch.mock.calls.filter(([path, init]) => path === BASE && init === undefined).length;
}

beforeEach(async () => {
  await setTestLocale('en-US');
  mockApiFetch.mockReset();
  mockShow.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('RecommendationsPanel', () => {
  it('renders every panel state', async () => {
    const states: ReadonlyArray<[string, IRecommendationsResponse, (panel: HTMLElement) => void]> = [
      ['empty', response({ run: null, recommendations: [] }), (panel) => {
        expect(within(panel).getByTestId('recommendations-empty')).toBeInTheDocument();
        expect(within(panel).getByTestId('recommendations-generate')).toBeEnabled();
        expect(within(panel).queryAllByTestId('recommendation-row')).toHaveLength(0);
      }],
      ['pending with no run', response({ run: null, pending: true, recommendations: [] }), (panel) => {
        expect(within(panel).getByTestId('recommendations-generating')).toHaveTextContent('Generating recommendations');
        expect(within(panel).getByTestId('recommendations-generate')).toBeEnabled();
        expect(within(panel).queryByTestId('recommendations-empty')).toBeNull();
        expect(within(panel).queryAllByTestId('recommendation-row')).toHaveLength(0);
      }],
      ['pending with a run', response({ pending: true }), (panel) => {
        expect(within(panel).getByTestId('recommendations-generating')).toBeInTheDocument();
        expect(within(panel).getAllByTestId('recommendation-row')).toHaveLength(1);
      }],
      ['listed run', response(), (panel) => {
        expect(within(panel).getAllByTestId('recommendation-row')).toHaveLength(1);
        expect(within(panel).queryByTestId('recommendations-generating')).toBeNull();
        expect(within(panel).queryByTestId('recommendations-stale')).toBeNull();
      }],
      ['stale', response({ run: { ...RUN, stale: true } }), (panel) => {
        expect(within(panel).getByTestId('recommendations-stale')).toHaveTextContent('The deck list changed');
        expect(within(panel).getByTestId('recommendations-generate')).toBeEnabled();
      }],
      ['failure', response({ failure: { code: 'RATE_LIMITED', finishedAt: '2026-10-06T11:00:00.000Z' } }), (panel) => {
        expect(within(panel).getByTestId('recommendations-failure')).toHaveTextContent('The model hit its usage limit');
        expect(within(panel).getByTestId('recommendations-generate')).toBeEnabled();
        expect(within(panel).getAllByTestId('recommendation-row')).toHaveLength(1);
      }],
      ['done with no cards', response({ recommendations: [] }), (panel) => {
        expect(within(panel).getByTestId('recommendations-no-upgrades')).toHaveTextContent('No upgrades found');
        expect(within(panel).getByTestId('recommendations-generate')).toBeEnabled();
      }],
    ];

    for (const [label, body, assert] of states) {
      mockApiFetch.mockReset();
      mockApiFetch.mockResolvedValue(body);
      const { unmount } = render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <RecommendationsPanel deckId={DECK_ID} deckCards={DECK_CARDS} />
        </QueryClientProvider>,
      );
      const panel = await screen.findByTestId('recommendations-panel');
      await waitFor(() => expect(mockApiFetch).toHaveBeenCalled());
      await waitFor(() => assert(panel), { timeout: 2000 }).catch((error: Error) => {
        throw new Error(`${label}: ${error.message}`);
      });
      unmount();
    }
  });

  it('polls every 10 seconds only while pending', async () => {
    vi.useFakeTimers();
    mockApiFetch.mockResolvedValue(response({ pending: true }));
    renderPanel();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(reads()).toBe(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(9_999);
    });
    expect(reads()).toBe(1);
    mockApiFetch.mockResolvedValue(response({ pending: false }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(reads()).toBe(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(reads()).toBe(2);
  });

  it('a row shows reason, ownership or price, and the cut', async () => {
    mockApiFetch.mockResolvedValue(
      response({
        recommendations: [
          recommendation({ id: 'owned', cardIdentifier: 'owned-card', name: 'Owned Card', freeCopies: 1, cutCardIdentifier: 'flex-red', cutName: 'Flex', cutSlot: 'mainboard' }),
          recommendation({ id: 'priced', cardIdentifier: 'priced-card', name: 'Priced Card', priceCents: 450, productUrl: 'https://www.cupuladt.com.br/p/1' }),
          recommendation({ id: 'stockless', cardIdentifier: 'stockless-card', name: 'Stockless Card' }),
        ],
      }),
    );
    renderPanel();

    const rows = await screen.findAllByTestId('recommendation-row');
    const [owned, priced, stockless] = rows as [HTMLElement, HTMLElement, HTMLElement];
    expect(within(owned).getByTestId('recommendation-name')).toHaveTextContent('Owned Card');
    expect(within(owned).getByText('Pumps the attacks Katsu chains together.')).toBeInTheDocument();
    expect(within(within(owned).getByTestId('recommendation-art')).getAllByText('Owned Card').length).toBeGreaterThan(0);
    expect(within(owned).getByTestId('recommendation-owned')).toHaveTextContent('owned');
    expect(within(owned).getByTestId('recommendation-cut')).toHaveTextContent('replaces Flex');
    const link = within(priced).getByRole('link');
    expect(link).toHaveAttribute('href', 'https://www.cupuladt.com.br/p/1');
    expect(link).toHaveTextContent('R$ 4,50');
    expect(within(priced).queryByTestId('recommendation-owned')).toBeNull();
    expect(within(stockless).getByTestId('recommendation-out-of-stock')).toHaveTextContent('out of stock');
    expect(within(stockless).queryByTestId('recommendation-cut')).toBeNull();
    expect(within(stockless).queryByText(/replaces/)).toBeNull();
  });

  it('names cards with their pitch and shows the cost of the card and its cut', async () => {
    mockApiFetch.mockResolvedValue(
      response({
        recommendations: [
          recommendation({
            cardIdentifier: 'spire-sniping-red',
            name: 'Spire Sniping',
            pitch: 1,
            cost: 1,
            cutCardIdentifier: 'spire-sniping-yellow',
            cutName: 'Spire Sniping',
            cutPitch: 2,
            cutCost: 0,
            cutSlot: 'mainboard',
          }),
        ],
      }),
    );
    renderPanel();

    const row = await screen.findByTestId('recommendation-row');
    expect(within(row).getByTestId('recommendation-name')).toHaveTextContent('Spire Sniping (Red)');
    expect(within(row).getByTestId('recommendation-cost')).toHaveTextContent('cost 1');
    expect(within(row).getByTestId('recommendation-cut')).toHaveTextContent('replaces Spire Sniping (Yellow) · cost 0');
    const options = [...(within(row).getByTestId('recommendation-cut-select') as HTMLSelectElement).options].map((option) => option.textContent);
    expect(options).toEqual(['Pick a card', 'Flex (Red)', 'Emissary of Tides (Red)']);
  });

  it('tapping the art opens the card large without adopting it', async () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    });
    mockApiFetch.mockResolvedValue(
      response({
        recommendations: [
          recommendation({
            imageUrl: { small: 'https://img.test/a.webp', large: 'https://img.test/a-l.webp', sources: [{ small: 'https://img.test/b.webp', large: 'https://img.test/b-l.webp' }] },
          }),
        ],
      }),
    );
    renderPanel();
    const row = await screen.findByTestId('recommendation-row');

    await userEvent.click(within(row).getByRole('button', { name: 'See Adrenaline Rush (Red)' }));

    const dialog = await screen.findByRole('dialog', { name: /Adrenaline Rush \(Red\)/ });
    expect(within(dialog).getByRole('img')).toHaveAttribute('src', 'https://img.test/a-l.webp');
    expect(mockApiFetch.mock.calls.some(([, init]) => (init as { method?: string } | undefined)?.method === 'POST')).toBe(false);
  });

  it('Generate sends the run request', async () => {
    const user = userEvent.setup();
    mockApiFetch.mockImplementation(async (path: string, init?: { method?: string }) =>
      init?.method === 'POST' ? { run: { id: 'run-2', status: 'pending' } } : response({ run: null, recommendations: [] }),
    );
    renderPanel();
    await screen.findByTestId('recommendations-empty');
    mockApiFetch.mockImplementation(async (path: string, init?: { method?: string }) =>
      init?.method === 'POST' ? { run: { id: 'run-2', status: 'pending' } } : response({ run: null, pending: true, recommendations: [] }),
    );

    await user.click(screen.getByTestId('recommendations-generate'));

    expect(mockApiFetch).toHaveBeenCalledWith(`${BASE}/runs`, { method: 'POST' });
    expect(await screen.findByTestId('recommendations-generating')).toBeInTheDocument();
  });

  it('badges clear upgrades only', async () => {
    mockApiFetch.mockResolvedValue(
      response({
        recommendations: [
          recommendation({ id: 'a', cardIdentifier: 'clear', strength: 'clear_upgrade' }),
          recommendation({ id: 'b', cardIdentifier: 'maybe', strength: 'consider' }),
        ],
      }),
    );
    renderPanel();

    const [clear, maybe] = (await screen.findAllByTestId('recommendation-row')) as [HTMLElement, HTMLElement];
    expect(within(clear).getByTestId('clear-upgrade-badge')).toHaveTextContent('clear upgrade');
    expect(within(maybe).queryByTestId('clear-upgrade-badge')).toBeNull();
  });

  it('Dismiss removes the row and offers undo', async () => {
    const user = userEvent.setup();
    mockApiFetch.mockImplementation(async (path: string, init?: { method?: string }) =>
      init?.method ? undefined : response(),
    );
    renderPanel();
    const row = await screen.findByTestId('recommendation-row');

    await user.click(within(row).getByRole('button', { name: 'Stop recommending Adrenaline Rush for this deck' }));

    expect(mockApiFetch).toHaveBeenCalledWith(`${BASE}/dismissals`, {
      method: 'POST',
      body: JSON.stringify({ cardIdentifier: 'adrenaline-rush-red' }),
    });
    expect(screen.queryByTestId('recommendation-row')).toBeNull();
    await waitFor(() => expect(mockShow).toHaveBeenCalled());
    const toast = mockShow.mock.calls[0]![0] as { message: string; action: { label: string; onClick: () => void } };
    expect(toast.message).toBe('Adrenaline Rush will not be recommended again.');
    expect(toast.action.label).toBe('Undo');

    act(() => toast.action.onClick());

    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith(`${BASE}/dismissals/adrenaline-rush-red`, { method: 'DELETE' }),
    );
  });

  it('Adopt sends the chosen cut and reports a refusal', async () => {
    const user = userEvent.setup();
    mockApiFetch.mockImplementation(async (path: string, init?: { method?: string }) => {
      if (init?.method === 'POST') throw new ApiError(409, JSON.stringify({ code: 'REPLACEMENT_ILLEGAL' }));
      return response({
        recommendations: [recommendation({ id: 'rec-9', cutCardIdentifier: 'flex-red', cutName: 'Flex', cutSlot: 'mainboard' })],
      });
    });
    renderPanel();
    const row = await screen.findByTestId('recommendation-row');
    const select = within(row).getByTestId('recommendation-cut-select') as HTMLSelectElement;

    expect(select.value).toBe('flex-red');
    expect([...select.options].map((option) => option.value)).toEqual(['', 'flex-red', 'emissary-of-tides-red']);

    await user.selectOptions(select, 'emissary-of-tides-red');
    await user.click(within(row).getByRole('button', { name: 'Use Adrenaline Rush in the deck' }));

    expect(mockApiFetch).toHaveBeenCalledWith(`${BASE}/rec-9/adopt`, {
      method: 'POST',
      body: JSON.stringify({ cutCardIdentifier: 'emissary-of-tides-red', cutSlot: 'mainboard' }),
    });
    expect(await screen.findByTestId('recommendations-action-error')).toHaveTextContent('That card cannot take this place in the deck.');

    mockApiFetch.mockImplementation(async (path: string, init?: { method?: string }) => {
      if (init?.method === 'POST') throw new ApiError(409, JSON.stringify({ code: 'NOTHING_TO_REPLACE' }));
      return response({ recommendations: [recommendation({ id: 'rec-9', cutCardIdentifier: 'flex-red', cutName: 'Flex', cutSlot: 'mainboard' })] });
    });
    await user.click(within(row).getByRole('button', { name: 'Use Adrenaline Rush in the deck' }));
    expect(await screen.findByTestId('recommendations-action-error')).toHaveTextContent(NOTHING_TO_REPLACE_MESSAGE);
  });

  it('every mutation refreshes the data it changes', async () => {
    const user = userEvent.setup();
    mockApiFetch.mockImplementation(async (path: string, init?: { method?: string }) =>
      init?.method ? { ok: true } : response({ recommendations: [recommendation({ id: 'rec-9', cutCardIdentifier: 'flex-red', cutName: 'Flex', cutSlot: 'mainboard' })] }),
    );
    renderPanel();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const row = await screen.findByTestId('recommendation-row');
    const keysAfter = async (act: () => Promise<void>): Promise<string[]> => {
      invalidate.mockClear();
      await act();
      await waitFor(() => expect(invalidate).toHaveBeenCalled());
      return invalidate.mock.calls.map(([filters]) => JSON.stringify(filters?.queryKey)).sort();
    };
    const recommendationsKey = JSON.stringify(['recommendations', DECK_ID]);
    const decksKey = JSON.stringify(['decks']);

    expect(await keysAfter(() => user.click(screen.getByTestId('recommendations-generate')))).toEqual([decksKey, recommendationsKey].sort());
    expect(
      await keysAfter(() => user.click(within(row).getByRole('button', { name: 'Use Adrenaline Rush in the deck' }))),
    ).toEqual([decksKey, recommendationsKey, JSON.stringify(deckDetailQueryKey(String(DECK_ID))), JSON.stringify(SWAPS_QUERY_KEY)].sort());
    expect(mockApiFetch).toHaveBeenCalledWith(`${BASE}/rec-9/adopt`, {
      method: 'POST',
      body: JSON.stringify({ cutCardIdentifier: 'flex-red', cutSlot: 'mainboard' }),
    });
    expect(screen.queryByTestId('recommendations-action-error')).toBeNull();
    const freshRow = await screen.findByTestId('recommendation-row');
    expect(
      await keysAfter(() => user.click(within(freshRow).getByRole('button', { name: 'Stop recommending Adrenaline Rush for this deck' }))),
    ).toEqual([decksKey, recommendationsKey].sort());
    await waitFor(() => expect(mockShow).toHaveBeenCalled());
    const toast = mockShow.mock.calls[0]![0] as { action: { onClick: () => void } };
    expect(await keysAfter(async () => act(() => toast.action.onClick()))).toEqual([decksKey, recommendationsKey].sort());
  });
});
