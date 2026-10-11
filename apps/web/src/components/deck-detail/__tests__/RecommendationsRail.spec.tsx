import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { IGeneration, IRecommendationCard, IRecommendationsResponse } from '../../../api/recommendations';
import { setTestLocale } from '../../../test/i18n-test-utils';

const mockApiFetch = vi.fn();
vi.mock('../../../lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/api-client')>();
  return { ...actual, useApiClient: () => mockApiFetch };
});

const mockShow = vi.fn();
vi.mock('../../ui/Toast/useToast', () => ({ useToast: () => ({ show: mockShow }) }));

import { ApiError } from '../../../lib/api-client';
import { RecommendationsRail } from '../recommendations/RecommendationsRail';
import type { IRecommendationDeckCard } from '../recommendations/card-naming';
import { deckDetailQueryKey } from '../../../api/deck-detail';
import { SWAPS_QUERY_KEY } from '../../../api/swaps';
import { ptBR } from '../../../i18n/locales/pt-BR';

const DECK_ID = 7;
const BASE = `/decks/${DECK_ID}/recommendations`;
const HERO = 'Azalea, Ace in the Hole';

function image(code: string) {
  return { small: `https://img.test/small/${code}.webp`, large: `https://img.test/large/${code}.webp`, sources: [] };
}

const DECK_CARDS: IRecommendationDeckCard[] = [
  { cardIdentifier: 'flex-red', name: 'Flex', slot: 'mainboard', pitch: 1, cost: 0, imageUrl: image('flex') },
  { cardIdentifier: 'emissary-of-tides-red', name: 'Emissary of Tides', slot: 'mainboard', pitch: 1, cost: 2, imageUrl: image('emissary') },
  { cardIdentifier: 'talishar-the-lost-prince', name: 'Talishar, the Lost Prince', slot: 'weapon', pitch: null, cost: null, imageUrl: null },
];

function recommendation(overrides: Partial<IRecommendationCard> = {}): IRecommendationCard {
  return {
    id: 'rec-1',
    rank: 1,
    cardIdentifier: 'adrenaline-rush-red',
    name: 'Adrenaline Rush',
    pitch: 1,
    cost: 0,
    imageUrl: image('adrenaline'),
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

function generation(overrides: Partial<IGeneration> = {}): IGeneration {
  return {
    status: 'running',
    elapsedMs: 0,
    typicalMs: null,
    poolSize: 821,
    poolSample: [
      { cardIdentifier: 'spire-sniping-red', name: 'Spire Sniping', imageUrl: image('spire') },
      { cardIdentifier: 'take-aim-red', name: 'Take Aim', imageUrl: image('take-aim') },
    ],
    ...overrides,
  };
}

function response(overrides: Partial<IRecommendationsResponse> = {}): IRecommendationsResponse {
  return { run: RUN, pending: false, failure: null, generation: null, recommendations: [recommendation()], ...overrides };
}

let client: QueryClient;

function renderRail(): void {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RecommendationsRail deckId={DECK_ID} deckCards={DECK_CARDS} heroName={HERO} />
    </QueryClientProvider>,
  );
}

function reads(): number {
  return mockApiFetch.mock.calls.filter(([path, init]) => path === BASE && init === undefined).length;
}

function setReducedMotion(reduced: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => ({
      matches: reduced && query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
}

/** The server's elapsed time keeps growing between polls, as the real read route's does. */
function serveGenerationFrom(elapsedMs: number, typicalMs: number): void {
  const start = Date.now();
  mockApiFetch.mockImplementation(async () =>
    response({ run: null, pending: true, generation: generation({ elapsedMs: elapsedMs + Date.now() - start, typicalMs }), recommendations: [] }),
  );
}

async function flush(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

beforeEach(async () => {
  await setTestLocale('pt-BR');
  setReducedMotion(false);
  mockApiFetch.mockReset();
  mockShow.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('RecommendationsRail', () => {
  it('titles the section in both languages', async () => {
    mockApiFetch.mockResolvedValue(response());
    renderRail();
    expect(await screen.findByRole('heading', { level: 2 })).toHaveTextContent('Recomendações para este deck');
    document.body.innerHTML = '';

    await setTestLocale('en-US');
    renderRail();
    expect(await screen.findByRole('heading', { level: 2 })).toHaveTextContent('Recommendations for this deck');
  });

  it('renders one swap card per recommendation in rank order', async () => {
    mockApiFetch.mockResolvedValue(
      response({
        recommendations: [
          recommendation({ id: 'a', rank: 1, cardIdentifier: 'first', name: 'First' }),
          recommendation({ id: 'b', rank: 2, cardIdentifier: 'second', name: 'Second' }),
          recommendation({ id: 'c', rank: 3, cardIdentifier: 'third', name: 'Third' }),
        ],
      }),
    );
    renderRail();

    const rail = await screen.findByTestId('recommendations-rail');
    const cards = within(rail).getAllByTestId('recommendation-row');
    expect(cards.map((card) => card.getAttribute('data-card'))).toEqual(['first', 'second', 'third']);
    expect(cards.every((card) => card.parentElement === rail)).toBe(true);
    const css = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../recommendations/RecommendationsRail.module.css'), 'utf8');
    expect(/\.rail\s*{[^}]*overflow-x:\s*auto/.exec(css)).not.toBeNull();
    expect(rail.className).toMatch(/rail/);
  });

  it('a swap card shows art, name, chips, reason, cut and actions', async () => {
    mockApiFetch.mockResolvedValue(
      response({
        recommendations: [
          recommendation({ id: 'clear', cardIdentifier: 'clear-card', name: 'Clear Card', strength: 'clear_upgrade', pitch: 1 }),
          recommendation({ id: 'maybe', cardIdentifier: 'maybe-card', name: 'Maybe Card', strength: 'consider', pitch: 3 }),
        ],
      }),
    );
    renderRail();

    const [clear, maybe] = (await screen.findAllByTestId('recommendation-row')) as [HTMLElement, HTMLElement];
    expect(within(clear).getByRole('img', { name: 'Clear Card (Vermelho)' })).toHaveAttribute('src', 'https://img.test/large/adrenaline.webp');
    expect(within(clear).getByTestId('recommendation-name')).toHaveTextContent('Clear Card (Vermelho)');
    expect(within(clear).getByTestId('clear-upgrade-badge')).toHaveTextContent('melhoria clara');
    expect(within(clear).queryByTestId('recommendation-consider')).toBeNull();
    expect(within(maybe).getByTestId('recommendation-name')).toHaveTextContent('Maybe Card (Azul)');
    expect(within(maybe).getByTestId('recommendation-consider')).toHaveTextContent('considerar');
    expect(within(maybe).queryByTestId('clear-upgrade-badge')).toBeNull();
    expect(within(clear).getByText('Pumps the attacks Katsu chains together.')).toBeInTheDocument();
    expect(within(clear).getByLabelText('No lugar de')).toBe(within(clear).getByTestId('recommendation-cut-select'));
    expect(within(clear).getByRole('button', { name: 'Usar Clear Card no deck' })).toHaveTextContent('Usar');
    expect(within(clear).getByRole('button', { name: 'Não recomendar mais Clear Card para este deck' })).toHaveTextContent('Dispensar');
  });

  it('ownership reads owned, price or out of stock', async () => {
    mockApiFetch.mockResolvedValue(
      response({
        recommendations: [
          recommendation({ id: 'owned', cardIdentifier: 'owned', freeCopies: 1 }),
          recommendation({ id: 'priced', cardIdentifier: 'priced', priceCents: 450, productUrl: 'https://www.cupuladt.com.br/p/1' }),
          recommendation({ id: 'stockless', cardIdentifier: 'stockless' }),
        ],
      }),
    );
    renderRail();

    const [owned, priced, stockless] = (await screen.findAllByTestId('recommendation-row')) as [HTMLElement, HTMLElement, HTMLElement];
    expect(within(owned).getByTestId('recommendation-owned')).toHaveTextContent('na coleção');
    const link = within(priced).getByRole('link');
    expect(link).toHaveAttribute('href', 'https://www.cupuladt.com.br/p/1');
    expect(link).toHaveTextContent('R$ 4,50');
    expect(within(priced).queryByTestId('recommendation-owned')).toBeNull();
    expect(within(stockless).getByTestId('recommendation-out-of-stock')).toHaveTextContent('sem estoque');
  });

  it('tucks the cut card behind and preselects it', async () => {
    mockApiFetch.mockResolvedValue(
      response({
        recommendations: [
          recommendation({ id: 'cut', cardIdentifier: 'with-cut', cutCardIdentifier: 'flex-red', cutName: 'Flex', cutPitch: 1, cutCost: 0, cutSlot: 'mainboard' }),
          recommendation({ id: 'none', cardIdentifier: 'without-cut' }),
        ],
      }),
    );
    renderRail();

    const [withCut, withoutCut] = (await screen.findAllByTestId('recommendation-row')) as [HTMLElement, HTMLElement];
    const tucked = within(withCut).getByTestId('recommendation-cut-art');
    expect(within(tucked).getByRole('img', { name: 'Flex (Vermelho)' })).toHaveAttribute('src', 'https://img.test/small/flex.webp');
    expect(within(withCut).getByText('sai')).toBeInTheDocument();
    expect((within(withCut).getByTestId('recommendation-cut-select') as HTMLSelectElement).value).toBe('flex-red');
    expect(within(withoutCut).queryByTestId('recommendation-cut-art')).toBeNull();
    expect(within(withoutCut).queryByText('sai')).toBeNull();
    expect((within(withoutCut).getByTestId('recommendation-cut-select') as HTMLSelectElement).value).toBe('');
  });

  it('the cost chip compares with the cut card', async () => {
    const cut = { cutCardIdentifier: 'flex-red', cutName: 'Flex', cutPitch: 1, cutSlot: 'mainboard' };
    const rows: ReadonlyArray<[Partial<IRecommendationCard>, string | null]> = [
      [{ cost: 1, ...cut, cutCost: 0 }, '+1 custo'],
      [{ cost: 0, ...cut, cutCost: 2 }, '-2 custo'],
      [{ cost: 1, ...cut, cutCost: 1 }, 'mesmo custo'],
      [{ cost: 2 }, 'custo 2'],
      [{ cost: 2, ...cut, cutCost: null }, 'custo 2'],
      [{ cost: null }, null],
    ];
    mockApiFetch.mockResolvedValue(
      response({ recommendations: rows.map(([overrides], index) => recommendation({ id: `r${index}`, cardIdentifier: `card-${index}`, ...overrides })) }),
    );
    renderRail();

    const cards = await screen.findAllByTestId('recommendation-row');
    rows.forEach(([, expected], index) => {
      const chip = within(cards[index]!).queryByTestId('recommendation-cost');
      if (expected === null) expect(chip).toBeNull();
      else expect(chip).toHaveTextContent(expected);
    });
  });

  it('tapping the art opens the card large without adopting it', async () => {
    mockApiFetch.mockResolvedValue(response());
    renderRail();
    const card = await screen.findByTestId('recommendation-row');

    await userEvent.click(within(card).getByRole('button', { name: 'Ver Adrenaline Rush (Vermelho)' }));

    const dialog = await screen.findByRole('dialog', { name: /Adrenaline Rush \(Vermelho\)/ });
    expect(within(dialog).getByRole('img')).toHaveAttribute('src', 'https://img.test/large/adrenaline.webp');
    expect(mockApiFetch.mock.calls.some(([, init]) => (init as { method?: string } | undefined)?.method === 'POST')).toBe(false);
  });

  it('Usar adopts with the chosen cut', async () => {
    const user = userEvent.setup();
    mockApiFetch.mockImplementation(async (path: string, init?: { method?: string }) => {
      if (init?.method === 'POST') throw new ApiError(409, JSON.stringify({ code: 'NOTHING_TO_REPLACE' }));
      return response({
        recommendations: [
          recommendation({ id: 'rec-9', cutCardIdentifier: 'flex-red', cutName: 'Flex', cutSlot: 'mainboard' }),
          recommendation({ id: 'rec-10', cardIdentifier: 'no-cut' }),
        ],
      });
    });
    renderRail();
    const [card, noCut] = (await screen.findAllByTestId('recommendation-row')) as [HTMLElement, HTMLElement];

    expect(within(noCut).getByRole('button', { name: 'Usar Adrenaline Rush no deck' })).toBeDisabled();
    await user.selectOptions(within(card).getByTestId('recommendation-cut-select'), 'emissary-of-tides-red');
    await user.click(within(card).getByRole('button', { name: 'Usar Adrenaline Rush no deck' }));

    expect(mockApiFetch).toHaveBeenCalledWith(`${BASE}/rec-9/adopt`, {
      method: 'POST',
      body: JSON.stringify({ cutCardIdentifier: 'emissary-of-tides-red', cutSlot: 'mainboard' }),
    });
    expect(await screen.findByTestId('recommendations-action-error')).toHaveTextContent(ptBR.recommendations.cutGone);
  });

  it('Dispensar hides the card and offers undo', async () => {
    const user = userEvent.setup();
    mockApiFetch.mockImplementation(async (path: string, init?: { method?: string }) => (init?.method ? undefined : response()));
    renderRail();
    const card = await screen.findByTestId('recommendation-row');

    await user.click(within(card).getByRole('button', { name: 'Não recomendar mais Adrenaline Rush para este deck' }));

    expect(mockApiFetch).toHaveBeenCalledWith(`${BASE}/dismissals`, { method: 'POST', body: JSON.stringify({ cardIdentifier: 'adrenaline-rush-red' }) });
    expect(screen.queryByTestId('recommendation-row')).toBeNull();
    await waitFor(() => expect(mockShow).toHaveBeenCalled());
    const toast = mockShow.mock.calls[0]![0] as { message: string; action: { label: string; onClick: () => void } };
    expect(toast.message).toBe('Adrenaline Rush não será mais recomendada.');
    expect(toast.action.label).toBe('Desfazer');

    act(() => toast.action.onClick());

    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith(`${BASE}/dismissals/adrenaline-rush-red`, { method: 'DELETE' }));
    expect(await screen.findByTestId('recommendation-row')).toBeInTheDocument();
  });

  it('renders every section state', async () => {
    const states: ReadonlyArray<[string, IRecommendationsResponse | Error, (section: HTMLElement) => void]> = [
      ['empty', response({ run: null, recommendations: [] }), (section) => {
        expect(within(section).getByTestId('recommendations-empty')).toHaveTextContent(ptBR.recommendations.empty);
        expect(within(section).getByTestId('recommendations-generate')).toHaveTextContent('Gerar');
        expect(within(section).getByTestId('recommendations-generate')).not.toHaveTextContent('Gerar de novo');
      }],
      ['done', response(), (section) => {
        expect(within(section).getByTestId('recommendations-generate')).toHaveTextContent('Gerar de novo');
        expect(within(section).getAllByTestId('recommendation-row')).toHaveLength(1);
      }],
      ['no upgrades', response({ recommendations: [] }), (section) => {
        expect(within(section).getByTestId('recommendations-no-upgrades')).toHaveTextContent(ptBR.recommendations.noUpgrades);
      }],
      ['failed', response({ failure: { code: 'MODEL_TIMEOUT', finishedAt: '2026-10-06T11:00:00.000Z' } }), (section) => {
        expect(within(section).getByTestId('recommendations-failure')).toHaveTextContent('O modelo demorou demais para responder.');
      }],
      ['load error', new Error('boom'), (section) => {
        expect(within(section).getByTestId('recommendations-load-error')).toHaveTextContent(ptBR.recommendations.loadError);
        expect(within(section).getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
      }],
      ['stale', response({ run: { ...RUN, stale: true } }), (section) => {
        expect(within(section).getByTestId('recommendations-stale')).toHaveTextContent(ptBR.recommendations.stale);
      }],
    ];

    for (const [label, body, assert] of states) {
      mockApiFetch.mockReset();
      if (body instanceof Error) mockApiFetch.mockRejectedValue(body);
      else mockApiFetch.mockResolvedValue(body);
      const { unmount } = render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <RecommendationsRail deckId={DECK_ID} deckCards={DECK_CARDS} heroName={HERO} />
        </QueryClientProvider>,
      );
      const section = await screen.findByTestId('recommendations-panel');
      await waitFor(() => assert(section), { timeout: 2000 }).catch((error: Error) => {
        throw new Error(`${label}: ${error.message}`);
      });
      if (label === 'load error') {
        const before = mockApiFetch.mock.calls.length;
        await userEvent.click(within(section).getByRole('button', { name: 'Tentar de novo' }));
        await waitFor(() => expect(mockApiFetch.mock.calls.length).toBeGreaterThan(before));
      }
      unmount();
    }
  });

  it('Gerar sends the run request', async () => {
    const user = userEvent.setup();
    mockApiFetch.mockImplementation(async (path: string, init?: { method?: string }) =>
      init?.method === 'POST' ? { run: { id: 'run-2', status: 'pending' } } : response({ run: null, recommendations: [] }),
    );
    renderRail();
    await screen.findByTestId('recommendations-empty');
    mockApiFetch.mockImplementation(async (path: string, init?: { method?: string }) =>
      init?.method === 'POST'
        ? { run: { id: 'run-2', status: 'pending' } }
        : response({ run: null, pending: true, generation: generation({ status: 'queued' }), recommendations: [] }),
    );

    await user.click(screen.getByTestId('recommendations-generate'));

    expect(mockApiFetch).toHaveBeenCalledWith(`${BASE}/runs`, { method: 'POST' });
    expect(await screen.findByTestId('generation-step')).toHaveTextContent('Na fila');
  });

  it('every mutation refreshes the data it changes', async () => {
    const user = userEvent.setup();
    mockApiFetch.mockImplementation(async (path: string, init?: { method?: string }) =>
      init?.method ? { ok: true } : response({ recommendations: [recommendation({ id: 'rec-9', cutCardIdentifier: 'flex-red', cutName: 'Flex', cutSlot: 'mainboard' })] }),
    );
    renderRail();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const card = await screen.findByTestId('recommendation-row');
    const keysAfter = async (action: () => Promise<void>): Promise<string[]> => {
      invalidate.mockClear();
      await action();
      await waitFor(() => expect(invalidate).toHaveBeenCalled());
      return invalidate.mock.calls.map(([filters]) => JSON.stringify(filters?.queryKey)).sort();
    };
    const recommendationsKey = JSON.stringify(['recommendations', DECK_ID]);
    const decksKey = JSON.stringify(['decks']);

    expect(await keysAfter(() => user.click(within(card).getByRole('button', { name: 'Usar Adrenaline Rush no deck' })))).toEqual(
      [decksKey, recommendationsKey, JSON.stringify(deckDetailQueryKey(String(DECK_ID))), JSON.stringify(SWAPS_QUERY_KEY)].sort(),
    );
    const freshCard = await screen.findByTestId('recommendation-row');
    expect(
      await keysAfter(() => user.click(within(freshCard).getByRole('button', { name: 'Não recomendar mais Adrenaline Rush para este deck' }))),
    ).toEqual([decksKey, recommendationsKey].sort());
    await waitFor(() => expect(mockShow).toHaveBeenCalled());
    const toast = mockShow.mock.calls[0]![0] as { action: { onClick: () => void } };
    expect(await keysAfter(async () => act(() => toast.action.onClick()))).toEqual([decksKey, recommendationsKey].sort());
    expect(await keysAfter(() => user.click(screen.getByTestId('recommendations-generate')))).toEqual([decksKey, recommendationsKey].sort());
  });

  it('shows the candidate pile while generating', async () => {
    mockApiFetch.mockResolvedValue(response({ run: null, pending: true, generation: generation(), recommendations: [] }));
    renderRail();

    const pile = await screen.findByTestId('recommendations-pile');
    const backs = pile.querySelectorAll('img[src$="card-back.webp"]');
    expect(backs.length).toBeGreaterThan(0);
    expect(pile).toHaveTextContent('821');
    expect(pile).toHaveTextContent('cartas candidatas');
  });

  it('the clock starts at the elapsed time and ticks every second', async () => {
    vi.useFakeTimers();
    mockApiFetch.mockResolvedValue(response({ run: null, pending: true, generation: generation({ elapsedMs: 65_000 }), recommendations: [] }));
    renderRail();
    await flush();

    expect(screen.getByTestId('generation-clock')).toHaveTextContent('1:05');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });
    expect(screen.getByTestId('generation-clock')).toHaveTextContent('1:08');
  });

  it('names the step the server is on', async () => {
    const rows: ReadonlyArray<[IGeneration['status'], string]> = [
      ['queued', 'Na fila'],
      ['retrying', 'O modelo estava ocupado; tentando de novo'],
      ['running', `O modelo avalia 821 cartas para ${HERO}`],
    ];
    for (const [status, expected] of rows) {
      mockApiFetch.mockReset();
      mockApiFetch.mockResolvedValue(response({ run: null, pending: true, generation: generation({ status }), recommendations: [] }));
      const { unmount } = render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <RecommendationsRail deckId={DECK_ID} deckCards={DECK_CARDS} heroName={HERO} />
        </QueryClientProvider>,
      );
      expect(await screen.findByTestId('generation-step')).toHaveTextContent(expected);
      unmount();
    }
  });

  it('shows the usual duration when known', async () => {
    mockApiFetch.mockResolvedValue(response({ run: null, pending: true, generation: generation({ typicalMs: 100_000 }), recommendations: [] }));
    renderRail();
    expect(await screen.findByTestId('generation-usual')).toHaveTextContent('costuma levar ~2 min');
    expect(screen.getByTestId('generation-typical-mark')).toBeInTheDocument();
    document.body.innerHTML = '';

    mockApiFetch.mockResolvedValue(response({ run: null, pending: true, generation: generation({ typicalMs: 70_000 }), recommendations: [] }));
    renderRail();
    expect(await screen.findByTestId('generation-usual')).toHaveTextContent('costuma levar ~1 min');
    document.body.innerHTML = '';

    mockApiFetch.mockResolvedValue(response({ run: null, pending: true, generation: generation({ typicalMs: null }), recommendations: [] }));
    renderRail();
    await screen.findByTestId('generation-clock');
    expect(screen.queryByTestId('generation-usual')).toBeNull();
    expect(screen.queryByTestId('generation-typical-mark')).toBeNull();
  });

  it('says when the run passes the usual time', async () => {
    vi.useFakeTimers();
    serveGenerationFrom(110_000, 100_000);
    renderRail();
    await flush();
    expect(screen.getByTestId('generation-usual')).toHaveTextContent('costuma levar ~2 min');
    expect(screen.getByTestId('generation-step')).toHaveTextContent(`O modelo avalia 821 cartas para ${HERO}`);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(9_000);
    });
    expect(screen.getByTestId('generation-step')).toHaveTextContent(`O modelo avalia 821 cartas para ${HERO}`);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });

    expect(screen.getByTestId('generation-step')).toHaveTextContent(
      'Passou do tempo de costume. Pode sair da página; as recomendações aparecem aqui quando terminarem.',
    );
  });

  it('lifts pool cards off the pile unless motion is reduced', async () => {
    vi.useFakeTimers();
    mockApiFetch.mockResolvedValue(response({ run: null, pending: true, generation: generation(), recommendations: [] }));
    renderRail();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_200);
    });
    const lift = screen.getByTestId('recommendations-pile-lift');
    const names = ['Spire Sniping', 'Take Aim'];
    const face = within(lift).getAllByRole('img').find((img) => names.includes(img.getAttribute('alt') ?? ''));
    expect(face).toBeDefined();
    expect(face).toHaveAttribute('src', expect.stringMatching(/^https:\/\/img\.test\/small\//));
    expect(names).toContain(screen.getByTestId('recommendations-pile-name').textContent);
    document.body.innerHTML = '';

    setReducedMotion(true);
    renderRail();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(screen.getByTestId('recommendations-pile')).toBeInTheDocument();
    expect(screen.queryByTestId('recommendations-pile-lift')).toBeNull();
  });

  it('keeps the previous cards dimmed while generating', async () => {
    mockApiFetch.mockResolvedValue(response({ pending: true, generation: generation() }));
    renderRail();

    const card = await screen.findByTestId('recommendation-row');
    expect(card).toHaveAttribute('data-dimmed', 'true');
    expect(within(card).getByRole('button', { name: 'Usar Adrenaline Rush no deck' })).toBeDisabled();
    expect(within(card).getByRole('button', { name: 'Não recomendar mais Adrenaline Rush para este deck' })).toBeDisabled();
    const button = screen.getByTestId('recommendations-generate');
    expect(button).toHaveTextContent('Gerando…');
    expect(button).toBeDisabled();
  });

  it('deals only when a different run arrives', async () => {
    vi.useFakeTimers();
    mockApiFetch.mockResolvedValue(response({ pending: true, generation: generation() }));
    renderRail();
    await flush();
    expect(screen.getByTestId('recommendations-pile')).toBeInTheDocument();

    mockApiFetch.mockResolvedValue(response({ failure: { code: 'MODEL_TIMEOUT', finishedAt: '2026-10-06T11:00:00.000Z' } }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_100);
    });
    expect(screen.getByTestId('recommendations-failure')).toBeInTheDocument();
    expect(screen.queryByTestId('recommendations-pile')).toBeNull();
    expect(screen.getByTestId('recommendation-row')).toHaveAttribute('data-dimmed', 'false');
    document.body.innerHTML = '';

    mockApiFetch.mockResolvedValue(response({ pending: true, generation: generation() }));
    renderRail();
    await flush();
    mockApiFetch.mockResolvedValue(response({ run: { ...RUN, id: 'run-2' }, recommendations: [recommendation({ id: 'rec-new' })] }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_100);
    });
    expect(screen.getByTestId('recommendations-generate')).toHaveTextContent('Gerar de novo');
    expect(screen.getByTestId('recommendations-pile')).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(screen.queryByTestId('recommendations-pile')).toBeNull();
  });

  it('reaches the usual-time mark half way round the ring, exactly when the warning shows', async () => {
    vi.useFakeTimers();
    serveGenerationFrom(60_000, 130_000);
    renderRail();
    await flush();
    const fill = (): number => {
      const [filled, circumference] = (screen.getByTestId('generation-ring-arc').getAttribute('stroke-dasharray') ?? '')
        .split(' ')
        .map(Number) as [number, number];
      return filled / circumference;
    };
    const mark = screen.getByTestId('generation-typical-mark');

    expect(screen.getByTestId('generation-usual')).toHaveTextContent('costuma levar ~2 min');
    expect([mark.getAttribute('x1'), mark.getAttribute('x2')]).toEqual(['15', '15']);
    expect(Number(mark.getAttribute('y1'))).toBeGreaterThan(15);
    expect(fill()).toBeCloseTo(0.25, 2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(fill()).toBeCloseTo(0.5, 2);
    expect(screen.getByTestId('generation-step')).not.toHaveTextContent('Passou do tempo de costume');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(screen.getByTestId('generation-step')).toHaveTextContent('Passou do tempo de costume');
    expect(fill()).toBeGreaterThan(0.5);
    expect(fill()).toBeLessThan(0.52);
  });

  it('polls every 10 seconds only while a run is active', async () => {
    vi.useFakeTimers();
    mockApiFetch.mockResolvedValue(response({ pending: true, generation: generation() }));
    renderRail();
    await flush();
    expect(reads()).toBe(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(9_999);
    });
    expect(reads()).toBe(1);
    mockApiFetch.mockResolvedValue(response({ pending: true, generation: null }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(reads()).toBe(2);
    mockApiFetch.mockResolvedValue(response({ pending: false, generation: null }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(reads()).toBe(3);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(reads()).toBe(3);
  });
});
