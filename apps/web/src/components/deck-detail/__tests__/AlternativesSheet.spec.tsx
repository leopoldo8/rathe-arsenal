import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '../../../lib/api-client';
import i18n from '../../../i18n';
import type { IAlternativeCard, IAlternativeGroup, IAlternativesResponse } from '../../../api/replacements';
import { setTestLocale } from '../../../test/i18n-test-utils';

const mockApiFetch = vi.fn();
vi.mock('../../../lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/api-client')>();
  return { ...actual, useApiClient: () => mockApiFetch };
});

import { AlternativesSheet } from '../AlternativesSheet';

const DECK_ID = 7;
const TARGET = { cardIdentifier: 'emissary-of-tides-red', name: 'Emissary of Tides', slot: 'mainboard' };

function card(overrides: Partial<IAlternativeCard> = {}): IAlternativeCard {
  return {
    cardIdentifier: 'coax-a-commotion-red',
    name: 'Coax a Commotion',
    pitch: 1,
    imageUrl: null,
    freeCopies: 0,
    priceCents: null,
    productUrl: null,
    rationale: {
      tier: 1,
      pitch: 'red',
      sharedClasses: ['Generic'],
      powerDelta: 0,
      defenseDelta: 0,
      sharedKeywords: [],
      relaxed: null,
    },
    ...overrides,
  };
}

function group(name: IAlternativeGroup['group'], cards: IAlternativeCard[]): IAlternativeGroup {
  return { group: name, cards };
}

function response(groups: IAlternativeGroup[], needed = 2): IAlternativesResponse {
  return { needed, groups };
}

const TWO_GROUPS = response([
  group('very_close', [
    card({ imageUrl: { small: 'https://img.test/coax.webp', large: 'https://img.test/coax-l.webp', sources: [] } }),
  ]),
  group('other_pitch', [
    card({
      cardIdentifier: 'brandish-blue',
      name: 'Brandish',
      pitch: 3,
      rationale: { ...card().rationale, tier: 2, pitch: 'red', relaxed: 'pitch' },
    }),
  ]),
]);

let client: QueryClient;
const onClose = vi.fn();

function renderSheet(): ReturnType<typeof render> {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AlternativesSheet deckId={DECK_ID} target={TARGET} onClose={onClose} />
    </QueryClientProvider>,
  );
}

function requestedPaths(): string[] {
  return mockApiFetch.mock.calls.map(([path]) => path as string);
}

beforeEach(() => {
  mockApiFetch.mockReset();
  onClose.mockReset();
});

describe('AlternativesSheet', () => {
  it('renders the groups and each card', async () => {
    mockApiFetch.mockResolvedValue(TWO_GROUPS);
    renderSheet();

    await screen.findByTestId('alternatives-group-very_close');

    expect(screen.getByRole('dialog')).toHaveTextContent('Alternativas para Emissary of Tides');
    expect(screen.getByTestId('alternatives-needed')).toHaveTextContent('Ocupa o lugar de 2 cópias que faltam.');
    const groups = screen.getAllByTestId(/^alternatives-group-/);
    expect(groups.map((g) => g.getAttribute('data-testid'))).toEqual([
      'alternatives-group-very_close',
      'alternatives-group-other_pitch',
    ]);
    expect(within(groups[0]!).getByRole('heading', { name: 'Muito parecidas' })).toBeInTheDocument();
    expect(within(groups[1]!).getByRole('heading', { name: 'Outro pitch' })).toBeInTheDocument();
    const first = within(groups[0]!).getByTestId('alternative-card');
    expect(first).toHaveTextContent('Coax a Commotion');
    expect(first.querySelector('img')).toHaveAttribute('src', 'https://img.test/coax.webp');
    expect(within(first).getByTestId('alternative-rationale')).toHaveTextContent('Mesmo pitch (vermelho)');
    expect(within(groups[1]!).getByTestId('alternative-rationale')).toHaveTextContent(
      'O pitch é diferente do da original.',
    );
    expect(within(first).getByRole('img', { name: 'pitch Vermelho' })).toBeInTheDocument();
    expect(within(within(groups[1]!).getByTestId('alternative-card')).getByRole('img', { name: 'pitch Azul' })).toBeInTheDocument();
  });

  it('marks owned and free copies', async () => {
    await setTestLocale('en-US');
    mockApiFetch.mockResolvedValue(
      response([
        group('very_close', [
          card({ cardIdentifier: 'owned-card', name: 'Owned Card', freeCopies: 2 }),
          card({ cardIdentifier: 'partial-card', name: 'Partial Card', freeCopies: 1 }),
        ]),
      ]),
    );
    renderSheet();

    await screen.findAllByTestId('alternative-card');

    const ownership = (id: string) =>
      within(screen.getAllByTestId('alternative-card').find((el) => el.getAttribute('data-card') === id)!).getByTestId(
        'alternative-ownership',
      );
    expect(ownership('owned-card')).toHaveTextContent('owned');
    expect(ownership('partial-card')).toHaveTextContent('1 free');
  });

  it('shows price or out of stock for cards not owned', async () => {
    mockApiFetch.mockResolvedValue(
      response([
        group('very_close', [
          card({ cardIdentifier: 'priced', name: 'Priced', priceCents: 350, productUrl: 'https://store.test/priced' }),
          card({ cardIdentifier: 'gone', name: 'Gone', priceCents: null, productUrl: null }),
          card({ cardIdentifier: 'owned', name: 'Owned', freeCopies: 2, priceCents: 500, productUrl: 'https://store.test/owned' }),
        ]),
      ]),
    );
    renderSheet();

    await screen.findAllByTestId('alternative-card');
    const rowOf = (id: string) => screen.getAllByTestId('alternative-card').find((el) => el.getAttribute('data-card') === id)!;

    const link = within(rowOf('priced')).getByRole('link');
    expect(link).toHaveTextContent('R$ 3,50');
    expect(link).toHaveAttribute('href', 'https://store.test/priced');
    expect(within(rowOf('gone')).getByTestId('alternative-out-of-stock')).toHaveTextContent('sem estoque');
    expect(within(rowOf('owned')).queryByRole('link')).toBeNull();
    expect(within(rowOf('owned')).queryByText(/R\$/)).toBeNull();

    await setTestLocale('en-US');
    await waitFor(() => expect(within(rowOf('gone')).getByTestId('alternative-out-of-stock')).toHaveTextContent('out of stock'));
  });

  it('shows loading while fetching', async () => {
    mockApiFetch.mockReturnValue(new Promise(() => undefined));
    renderSheet();

    expect(await screen.findByTestId('alternatives-loading')).toHaveTextContent('Procurando alternativas');
    expect(screen.queryByTestId(/^alternatives-group-/)).toBeNull();
  });

  it('shows error with retry', async () => {
    mockApiFetch.mockRejectedValueOnce(new ApiError(500, 'boom')).mockResolvedValue(TWO_GROUPS);
    renderSheet();

    const alert = await screen.findByTestId('alternatives-error');
    expect(alert).toHaveTextContent('Algo deu errado. Tente novamente.');

    await userEvent.click(within(alert).getByRole('button', { name: 'Tentar de novo' }));

    await screen.findByTestId('alternatives-group-very_close');
    expect(mockApiFetch).toHaveBeenCalledTimes(2);
  });

  it('focuses the search when nothing fits', async () => {
    mockApiFetch.mockResolvedValue(response([]));
    renderSheet();

    expect(await screen.findByTestId('alternatives-empty')).toHaveTextContent('Nenhuma carta do catálogo se encaixa');
    await waitFor(() => expect(screen.getByRole('searchbox')).toHaveFocus());
  });

  it('searches by name from 2 characters', async () => {
    mockApiFetch.mockImplementation(async (path: string) =>
      path.includes('q=si')
        ? response([group('search', [card({ cardIdentifier: 'sink-below-red', name: 'Sink Below' })])])
        : TWO_GROUPS,
    );
    renderSheet();
    await screen.findByTestId('alternatives-group-very_close');
    const input = screen.getByRole('searchbox');

    await userEvent.type(input, 's');
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(requestedPaths().filter((path) => path.includes('q='))).toEqual([]);

    await userEvent.type(input, 'i');
    await screen.findByTestId('alternatives-group-search');

    expect(requestedPaths().filter((path) => path.includes('q=si'))).toHaveLength(1);
    expect(screen.queryByTestId('alternatives-group-very_close')).toBeNull();
    expect(screen.getByTestId('alternatives-group-search')).toHaveTextContent('Sink Below');
  });

  describe('preview', () => {
    it('tapping the art previews the card without picking it, and Back returns to the list', async () => {
      mockApiFetch.mockImplementation(async (_path: string, init?: RequestInit) =>
        init?.method === 'POST' ? { replacement: {} } : TWO_GROUPS,
      );
      renderSheet();
      await screen.findByTestId('alternatives-group-other_pitch');

      await userEvent.click(screen.getByRole('button', { name: 'Ver Coax a Commotion antes de escolher' }));

      const view = screen.getByTestId('alternative-preview-view');
      expect(within(view).getByRole('img', { name: 'Coax a Commotion' })).toHaveAttribute('src', 'https://img.test/coax-l.webp');
      expect(view).toHaveTextContent('Coax a Commotion');
      expect(screen.queryByTestId('alternatives-group-very_close')).toBeNull();
      expect(mockApiFetch.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'POST')).toBe(false);
      expect(onClose).not.toHaveBeenCalled();

      await userEvent.click(screen.getByTestId('alternative-preview-back'));

      expect(screen.queryByTestId('alternative-preview-view')).toBeNull();
      expect(screen.getByTestId('alternatives-group-very_close')).toBeInTheDocument();
      expect(mockApiFetch.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'POST')).toBe(false);
    });

    it('"Use this card" in the preview sends the pick with its group', async () => {
      mockApiFetch.mockImplementation(async (_path: string, init?: RequestInit) =>
        init?.method === 'POST' ? { replacement: {} } : TWO_GROUPS,
      );
      renderSheet();
      await screen.findByTestId('alternatives-group-other_pitch');

      await userEvent.click(screen.getByRole('button', { name: 'Ver Brandish antes de escolher' }));
      await userEvent.click(screen.getByTestId('alternative-preview-pick'));

      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      const post = mockApiFetch.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'POST')!;
      expect(JSON.parse((post[1] as RequestInit).body as string)).toEqual(
        expect.objectContaining({ replacementCardIdentifier: 'brandish-blue', pickedFrom: 'other_pitch' }),
      );
    });
  });

  describe('picking', () => {
    it('a tap sends the pick with its group', async () => {
      mockApiFetch.mockImplementation(async (path: string, init?: RequestInit) => {
        if (init?.method === 'POST') return { replacement: {} };
        return path.includes('q=si')
          ? response([group('search', [card({ cardIdentifier: 'sink-below-red', name: 'Sink Below' })])])
          : TWO_GROUPS;
      });
      renderSheet();
      const invalidate = vi.spyOn(client, 'invalidateQueries');
      await screen.findByTestId('alternatives-group-other_pitch');

      await userEvent.click(screen.getByRole('button', { name: 'Usar Brandish no lugar' }));

      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      const post = mockApiFetch.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'POST')!;
      expect(post[0]).toBe(`/decks/${DECK_ID}/replacements`);
      expect(JSON.parse((post[1] as RequestInit).body as string)).toEqual({
        originalCardIdentifier: 'emissary-of-tides-red',
        slot: 'mainboard',
        replacementCardIdentifier: 'brandish-blue',
        pickedFrom: 'other_pitch',
      });
      const keys = invalidate.mock.calls.map(([filters]) => JSON.stringify(filters?.queryKey));
      expect(keys).toContain(JSON.stringify(['deck-detail', String(DECK_ID)]));
      expect(keys).toContain(JSON.stringify(['swaps']));

      onClose.mockReset();
      await userEvent.type(screen.getByRole('searchbox'), 'si');
      await screen.findByTestId('alternatives-group-search');
      await userEvent.click(screen.getByRole('button', { name: 'Usar Sink Below no lugar' }));
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      const searchPost = mockApiFetch.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'POST')[1]!;
      expect(JSON.parse((searchPost[1] as RequestInit).body as string).pickedFrom).toBe('search');
    });

    it.each([
      ['NOTHING_TO_REPLACE', 'Esta carta não tem mais cópias faltando para substituir.'],
      ['REPLACEMENT_ILLEGAL', 'Essa carta não pode ocupar esse lugar no deck.'],
      ['REPLACEMENT_NOT_ACTIVE', 'Esta substituição já foi resolvida.'],
    ])('shows the localized 409 message: %s', async (code, message) => {
      mockApiFetch.mockImplementation(async (_path: string, init?: RequestInit) => {
        if (init?.method === 'POST') throw new ApiError(409, JSON.stringify({ code, message: 'server text' }));
        return TWO_GROUPS;
      });
      renderSheet();
      const invalidate = vi.spyOn(client, 'invalidateQueries');
      await screen.findByTestId('alternatives-group-very_close');

      await userEvent.click(screen.getByRole('button', { name: 'Usar Coax a Commotion no lugar' }));

      expect(await screen.findByTestId('alternatives-pick-error')).toHaveTextContent(message);
      expect(onClose).not.toHaveBeenCalled();
      const keys = invalidate.mock.calls.map(([filters]) => JSON.stringify(filters?.queryKey));
      expect(keys).toContain(JSON.stringify(['deck-detail', String(DECK_ID)]));
    });
  });

  it('has copy for every new key in both locales', () => {
    const keys = [
      'alternatives.open',
      'alternatives.openAria',
      'alternatives.title',
      'alternatives.needed_one',
      'alternatives.needed_other',
      'alternatives.close',
      'alternatives.loading',
      'alternatives.retry',
      'alternatives.empty',
      'alternatives.searchLabel',
      'alternatives.searchPlaceholder',
      'alternatives.searchHint',
      'alternatives.searchEmpty',
      'alternatives.listAria',
      'alternatives.pickAria',
      'alternatives.previewAria',
      'alternatives.back',
      'alternatives.useThis',
      'alternatives.groupVeryClose',
      'alternatives.groupClose',
      'alternatives.groupOtherPitch',
      'alternatives.groupGeneric',
      'alternatives.groupSearch',
      'alternatives.owned',
      'alternatives.free_one',
      'alternatives.free_other',
      'alternatives.outOfStock',
      'alternatives.buyAria',
      'alternatives.relaxedPitch',
      'alternatives.relaxedClass',
      'alternatives.inPlaceOf',
      'alternatives.undo',
      'alternatives.undoAria',
      'alternatives.originalOwned',
      'alternatives.keep',
      'alternatives.keepAria',
      'alternatives.goBack',
      'alternatives.goBackAria',
      'apiErrors.NOTHING_TO_REPLACE',
      'apiErrors.REPLACEMENT_ILLEGAL',
      'apiErrors.REPLACEMENT_NOT_ACTIVE',
    ];

    for (const locale of ['pt-BR', 'en-US']) {
      const t = i18n.getFixedT(locale);
      for (const key of keys) {
        const value = t(key, { count: 1, name: 'X' });
        expect({ locale, key, ok: value.length > 0 && value !== key }).toEqual({ locale, key, ok: true });
      }
    }
  });
});
