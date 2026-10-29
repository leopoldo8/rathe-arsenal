import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '../../../lib/api-client';
import type { IShoppingLineLine, IShoppingLinePopulated } from '../../../api/shopping-line';
import { entry, swap } from './deckDetailTestData';
const mockApiFetch = vi.fn();
vi.mock('../../../lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/api-client')>();
  return { ...actual, useApiClient: () => mockApiFetch };
});

vi.mock('../../ui/Toast/useToast', () => ({ useToast: () => ({ show: vi.fn() }) }));
vi.mock('../ShareDialog', () => ({ ShareDialog: () => null }));

import { MissingPanel } from '../MissingPanel';
import markOwnedStyles from '../MarkOwnedButton.module.css';
import styles from '../MissingPanel.module.css';
import type { IAlternativesTarget, IDeckReplacement } from '../../../api/replacements';
import { setTestLocale } from '../../../test/i18n-test-utils';
import { MissingListPage } from '../../missing-list/MissingListPage';
import { line as missingLine, response as missingResponse } from '../../missing-list/__tests__/missingListKit';

const HOST = 'www.cupuladt.com.br';
const NOW = Date.now();
const FRESH = new Date(NOW - 60_000).toISOString();
const OLD = new Date(NOW - 9 * 86_400_000).toISOString();

function line(overrides: Partial<IShoppingLineLine>): IShoppingLineLine {
  return {
    cardIdentifier: 'card-a',
    cardName: 'Card A',
    pitch: null,
    quantityNeeded: 3,
    quantityAvailable: 3,
    unitPriceCents: 790,
    productUrl: `https://${HOST}/?id=1`,
    lastFetchedAt: FRESH,
    ...overrides,
  };
}

function populated(overrides: Partial<IShoppingLinePopulated> = {}): IShoppingLinePopulated {
  return {
    kind: 'populated',
    storeName: 'Cúpula DT',
    storeHostname: HOST,
    totalCostCents: 2370,
    availableCardCount: 1,
    unavailableCardCount: 1,
    lastFetchedAt: FRESH,
    lines: [line({})],
    ...overrides,
  };
}

const ENTRIES = [
  entry({ cardIdentifier: 'card-a', name: 'Card A', quantity: 3 }),
  entry({ cardIdentifier: 'card-b', name: 'Card B', quantity: 2 }),
];

function renderPanel(
  shoppingData: Parameters<typeof MissingPanel>[0]['shoppingData'],
  extra: Partial<Parameters<typeof MissingPanel>[0]> = {},
): void {
  render(
    <MissingPanel
      entries={ENTRIES}
      shoppingData={shoppingData}
      onMarkOwned={vi.fn()}
      isMarkingOwned={false}
      pendingCard={null}
      onShoppingRetry={vi.fn()}
      {...extra}
    />,
  );
}

const rowOf = (name: string): HTMLElement =>
  screen.getAllByTestId('missing-row').find((row) => row.textContent?.includes(name))!;

describe('MissingPanel — one merged panel', () => {
  it('renders a single panel and no separate shopping-line block', () => {
    renderPanel(populated());

    expect(screen.getAllByTestId('deck-missing-panel')).toHaveLength(1);
    expect(screen.queryByLabelText(/linha de compras|shopping line/i)).toBeNull();
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(screen.getByTestId('missing-store-summary')).toBeInTheDocument();
  });

  it('shows the store total in the header summary', () => {
    renderPanel(populated());

    expect(screen.getByTestId('missing-store-summary')).toHaveTextContent('R$ 23,70');
    expect(screen.getByTestId('missing-store-summary')).toHaveTextContent('1 de 2');
  });

  it('shows no store summary when the store was never scraped', () => {
    renderPanel({ kind: 'unscraped' });

    expect(screen.queryByTestId('missing-store-summary')).toBeNull();
    expect(within(rowOf('Card A')).queryByRole('link')).toBeNull();
    expect(within(rowOf('Card A')).queryByTestId('missing-row-unavailable')).toBeNull();
  });
});

describe('MissingPanel — pitch words in card names', () => {
  it('no question mark on the pitch word of a card name', () => {
    renderPanel(
      populated({
        lines: [
          line({ cardIdentifier: 'pack-hunt-red', cardName: 'Pack Hunt', pitch: 1 }),
          line({ cardIdentifier: 'pack-hunt-yellow', cardName: 'Pack Hunt', pitch: 2 }),
          line({ cardIdentifier: 'pack-hunt-blue', cardName: 'Pack Hunt', pitch: 3 }),
        ],
      }),
      {
        entries: [
          { ...ENTRIES[0]!, cardIdentifier: 'pack-hunt-red', name: 'Pack Hunt', pitch: 1 },
          { ...ENTRIES[0]!, cardIdentifier: 'pack-hunt-yellow', name: 'Pack Hunt', pitch: 2 },
          { ...ENTRIES[0]!, cardIdentifier: 'pack-hunt-blue', name: 'Pack Hunt', pitch: 3 },
        ],
      },
    );

    expect(screen.getByText('Pack Hunt (Vermelho)')).toBeInTheDocument();
    expect(screen.getByText('Pack Hunt (Amarelo)')).toBeInTheDocument();
    expect(screen.getByText('Pack Hunt (Azul)')).toBeInTheDocument();
    for (const word of ['Vermelho', 'Amarelo', 'Azul']) {
      expect(screen.queryByRole('button', { name: `O que é ${word}?` })).toBeNull();
    }
    expect(screen.queryByRole('button', { name: /^O que é / })).toBeNull();
  });
});

describe('MissingPanel — store states per row', () => {
  it('in stock: shows the price and a Buy link to the store product page', () => {
    renderPanel(populated());

    const row = rowOf('Card A');
    expect(within(row).getByTestId('missing-row-price')).toHaveTextContent('~R$ 7,90');
    const link = within(row).getByRole('link');
    expect(link).toHaveAttribute('href', `https://${HOST}/?id=1`);
    expect(link).toHaveTextContent('Comprar');
  });

  it('not carried by the store: explicit unavailable text and no buy control', () => {
    renderPanel(populated());

    const row = rowOf('Card B');
    expect(within(row).getByTestId('missing-row-unavailable')).toHaveTextContent('Indisponível na Cúpula DT');
    expect(within(row).queryByRole('link')).toBeNull();
  });

  it('listed with zero stock: unavailable, even when the line still carries a url', () => {
    renderPanel(
      populated({
        lines: [
          line({}),
          line({ cardIdentifier: 'card-b', quantityAvailable: 0, productUrl: `https://${HOST}/?id=2` }),
        ],
      }),
    );

    expect(within(rowOf('Card B')).getByTestId('missing-row-unavailable')).toBeInTheDocument();
    expect(within(rowOf('Card B')).queryByRole('link')).toBeNull();
  });

  it('verified zero stock says so', () => {
    renderPanel(
      populated({
        lines: [line({ cardIdentifier: 'card-b', quantityAvailable: 0, verificationStatus: 'verified_zero' })],
      }),
    );

    expect(within(rowOf('Card B')).getByTestId('missing-row-unavailable')).toHaveTextContent('Sem estoque na Cúpula DT (verificado)');
  });

  it('never renders a Buy link with an empty or foreign url (it would point at the deck page)', () => {
    renderPanel(
      populated({
        lines: [
          line({ productUrl: '' }),
          line({ cardIdentifier: 'card-b', productUrl: 'https://evil.example/x' }),
        ],
      }),
    );

    expect(screen.queryByRole('link')).toBeNull();
    expect(within(rowOf('Card A')).getByTestId('missing-row-price')).toBeInTheDocument();
  });

  it('partial stock shows the available count', () => {
    renderPanel(populated({ lines: [line({ quantityAvailable: 1 })] }));

    expect(within(rowOf('Card A')).getByText('1 de 3 disponíveis')).toBeInTheDocument();
  });

  it('uses the cheapest variant price and keeps the variant breakdown', () => {
    const variants = [
      { edition: 'Welcome', condition: 'NM', finish: 'Non-foil', priceCents: 500, quantity: 2 },
      { edition: 'Welcome', condition: 'LP', finish: 'Rainbow Foil', priceCents: 900, quantity: 1 },
    ];
    renderPanel(populated({ lines: [line({ hasVariantData: true, variants })] }));

    expect(within(rowOf('Card A')).getByTestId('missing-row-price')).toHaveTextContent('R$ 5,00 (NM)');
    expect(within(rowOf('Card A')).getByTestId('variant-breakdown-details')).toBeInTheDocument();
  });

});

describe('MissingPanel — preserved store behaviors', () => {
  it('warns about stale prices in the pt-BR UI without English leaking', () => {
    renderPanel(populated({ lastFetchedAt: OLD }));

    const summary = screen.getByTestId('missing-store-summary');
    expect(screen.getByTestId('missing-store-stale')).toBeInTheDocument();
    expect(summary).toHaveTextContent('atualizado há mais de uma semana');
    expect(summary.textContent).not.toMatch(/ago|over a week/i);
  });

  it('shows the retry affordance when the store query errored', () => {
    const onShoppingRetry = vi.fn();
    renderPanel({ kind: 'error', reason: 'x' }, { onShoppingRetry });

    fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(onShoppingRetry).toHaveBeenCalledTimes(1);
  });

  it('still wires Mark owned per row', () => {
    const onMarkOwned = vi.fn();
    renderPanel(populated(), { onMarkOwned });

    const button = within(rowOf('Card B')).getByRole('button', { name: 'Já tenho Card B (Vermelho)' });
    expect(button).toHaveClass(markOwnedStyles.btn!);
    fireEvent.click(button);
    expect(onMarkOwned).toHaveBeenCalledWith('card-b');
  });
});

describe('MissingPanel — calm row layout (owner feedback round 2)', () => {
  it('puts the price in the meta line under the card name', () => {
    renderPanel(populated());

    const meta = within(rowOf('Card A')).getByTestId('missing-row-meta');
    const price = within(meta).getByTestId('missing-row-price');
    expect(meta).toHaveClass(styles.meta!);
    expect(price).toHaveClass(styles.price!);
    expect(meta).not.toHaveTextContent('mainboard');
  });

  it('renders one quiet Buy link per available row, with an external-link arrow', () => {
    renderPanel(populated());

    const link = within(rowOf('Card A')).getByRole('link', { name: 'Comprar Card A (Vermelho) na loja' });
    expect(link).toHaveClass(styles.buy!);
    expect(link.parentElement).toHaveClass(styles.action!);
    expect(link).toHaveTextContent('Comprar↗');
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('an unavailable row shows muted text in the meta and no buy control at all', () => {
    renderPanel(populated());

    const row = rowOf('Card B');
    const unavailable = within(row).getByTestId('missing-row-unavailable');
    expect(unavailable).toHaveClass(styles.unavailable!);
    expect(within(row).getByTestId('missing-row-meta')).toContainElement(unavailable);
    expect(row.querySelector(`.${styles.buy}`)).toBeNull();
    expect(within(row).queryByRole('link')).toBeNull();
  });

  it('Mark owned is an icon button named for screen readers, with no visible label', () => {
    renderPanel(populated());

    const button = within(rowOf('Card A')).getByRole('button', { name: 'Já tenho Card A (Vermelho)' });
    expect(button).not.toHaveAttribute('title');
    expect(button).toHaveTextContent('');
    expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(button.parentElement).toHaveClass(styles.owned!);
  });

  it('the pending card keeps its name and is busy and disabled', () => {
    renderPanel(populated(), { isMarkingOwned: true, pendingCard: 'card-a' });

    const button = within(rowOf('Card A')).getByRole('button', { name: 'Já tenho Card A (Vermelho)' });
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).not.toHaveAttribute('title');
    expect(button).toBeDisabled();
  });
});

describe('MissingPanel — one quiet store line (owner feedback round 2)', () => {
  it('states total and coverage in one sentence', () => {
    renderPanel(populated({ isEstimated: true }));

    expect(screen.getByTestId('missing-store-total')).toHaveTextContent('~R$ 23,70');
    expect(screen.getByTestId('missing-store-summary')).toHaveTextContent(
      '~R$ 23,70 na Cúpula DT cobre 1 de 2 cartas que faltam',
    );
  });

  it('uses the singular when only one card is missing', () => {
    renderPanel(populated({ availableCardCount: 1, unavailableCardCount: 0 }));

    expect(screen.getByTestId('missing-store-summary')).toHaveTextContent('cobre 1 de 1 carta que falta');
  });

  it('shows the stale warning once, with the freshness, in one element', () => {
    renderPanel(populated({ lastFetchedAt: OLD }));

    const warnings = screen.getAllByTestId('missing-store-stale');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toHaveAttribute('data-freshness', 'very-stale');
    expect(warnings[0]).toHaveTextContent('atualizado há mais de uma semana (os preços podem ter mudado)');
    expect(screen.getAllByText(/os preços podem ter mudado/)).toHaveLength(1);
  });

  it('shows no stale warning while prices are fresh', () => {
    renderPanel(populated());

    expect(screen.queryByTestId('missing-store-stale')).toBeNull();
    expect(screen.getByTestId('missing-store-summary')).not.toHaveTextContent('os preços podem ter mudado');
  });

});

describe('MissingPanel — alternatives and replacements (card-alternatives)', () => {
  const replacementOf = (overrides: Partial<IDeckReplacement> = {}): IDeckReplacement => ({
    id: 'replacement-1',
    slot: 'mainboard',
    originalCardIdentifier: 'emissary-of-tides-red',
    originalName: 'Emissary of Tides',
    originalPitch: null,
    replacementCardIdentifier: 'coax-a-commotion-red',
    quantity: 2,
    originalOwned: false,
    ...overrides,
  });

  it('shows Alternatives only on replaceable rows', () => {
    const onOpenAlternatives = vi.fn<(target: IAlternativesTarget) => void>();
    renderPanel(null, {
      entries: [
        entry({ cardIdentifier: 'plain', name: 'Plain', slot: 'mainboard', quantity: 2 }),
        entry({ cardIdentifier: 'boots', name: 'Boots', slot: 'equipment', quantity: 1 }),
        entry({ cardIdentifier: 'hero', name: 'Hero', slot: 'hero', quantity: 1 }),
        entry({ cardIdentifier: 'blade', name: 'Blade', slot: 'weapon', quantity: 1 }),
        entry({ cardIdentifier: 'coax-a-commotion-red', name: 'Coax', slot: 'mainboard', quantity: 2 }),
      ],
      replacements: [replacementOf()],
      onOpenAlternatives,
    });
    const control = (name: string) => within(rowOf(name)).queryByRole('button', { name: /alternativas/i });

    expect(control('Plain')).not.toBeNull();
    expect(control('Boots')).not.toBeNull();
    expect(control('Hero')).toBeNull();
    expect(control('Blade')).toBeNull();
    expect(control('Coax')).toBeNull();

    fireEvent.click(control('Boots')!);
    expect(onOpenAlternatives).toHaveBeenCalledWith({ cardIdentifier: 'boots', name: 'Boots', slot: 'equipment' });
  });

  it('offers alternatives for the copies a replacement does not hold', () => {
    renderPanel(null, {
      entries: [entry({ cardIdentifier: 'coax-a-commotion-red', name: 'Coax', quantity: 3 })],
      replacements: [replacementOf()],
      onOpenAlternatives: vi.fn(),
    });

    expect(within(rowOf('Coax')).queryByRole('button', { name: /alternativas/i })).not.toBeNull();
  });

  it('marks a missing replacement with its original', async () => {
    await setTestLocale('en-US');
    renderPanel(null, {
      entries: [entry({ cardIdentifier: 'coax-a-commotion-red', name: 'Coax a Commotion', quantity: 2 })],
      replacements: [replacementOf()],
      onOpenAlternatives: vi.fn(),
    });

    expect(within(rowOf('Coax a Commotion')).getByTestId('replacement-mark')).toHaveTextContent(
      'in place of Emissary of Tides',
    );
  });

  it('marks a missing replacement with its original: a name with punctuation shows as the catalog spells it', async () => {
    await setTestLocale('en-US');
    renderPanel(null, {
      entries: [entry({ cardIdentifier: 'coax-a-commotion-red', name: 'Coax a Commotion', quantity: 2 })],
      replacements: [replacementOf({ originalCardIdentifier: 'a-moments-peace-blue', originalName: "A Moment's Peace" })],
      onOpenAlternatives: vi.fn(),
    });

    expect(within(rowOf('Coax a Commotion')).getByTestId('replacement-mark')).toHaveTextContent(
      "in place of A Moment's Peace",
    );
  });

  it('marks a missing replacement with its original: only the slot the replacement is in', async () => {
    await setTestLocale('en-US');
    renderPanel(null, {
      entries: [
        entry({ cardIdentifier: 'coax-a-commotion-red', name: 'Coax a Commotion', slot: 'mainboard', quantity: 2 }),
        entry({ cardIdentifier: 'coax-a-commotion-red', name: 'Coax a Commotion', slot: 'equipment', quantity: 2 }),
      ],
      replacements: [replacementOf({ slot: 'equipment' })],
      onOpenAlternatives: vi.fn(),
    });

    const rows = screen.getAllByTestId('missing-row');
    const marked = rows.filter((row) => within(row).queryByTestId('replacement-mark') !== null);
    expect(rows).toHaveLength(2);
    expect(marked).toHaveLength(1);
    // The equipment row is the replacement's own copies, so it offers no alternatives; the mainboard row does.
    expect(within(marked[0]!).queryByRole('button', { name: /alternatives/i })).toBeNull();
    const plain = rows.find((row) => row !== marked[0])!;
    expect(within(plain).getByRole('button', { name: /alternatives/i })).toBeInTheDocument();
  });
});

describe('MissingPanel — suggestions from the collection', () => {
  const DECK_ID = 7;
  const suggestion = swap({ cardIdentifier: 'card-a', name: 'Card A', quantity: 1 }, 'erase-face-red', 0.9, {
    name: 'Erase Face',
    pitch: 1,
  });

  function renderWithSuggestion(): void {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MissingPanel
          entries={ENTRIES}
          shoppingData={null}
          onMarkOwned={vi.fn()}
          isMarkingOwned={false}
          pendingCard={null}
          onShoppingRetry={vi.fn()}
          onOpenAlternatives={vi.fn()}
          deckId={DECK_ID}
          suggestions={new Map([['card-a::mainboard', suggestion]])}
        />
      </QueryClientProvider>,
    );
  }

  it("shows the collection's suggestion with Usar beside Ver alternativas", async () => {
    await setTestLocale('pt-BR');
    renderWithSuggestion();

    const row = rowOf('Card A');
    expect(within(row).getByTestId('missing-row-suggestion')).toHaveTextContent('Erase Face (Vermelho)');
    expect(within(row).getByTestId('missing-row-suggestion')).toHaveTextContent('da sua coleção');
    expect(within(row).getByRole('button', { name: /^Usar Erase Face \(Vermelho\) da sua coleção no lugar de Card A \(Vermelho\)$/ })).toHaveTextContent('Usar');
    expect(within(row).getByRole('button', { name: 'Ver alternativas para Card A (Vermelho)' })).toBeInTheDocument();
  });

  it('a row without a suggestion offers only the alternatives', async () => {
    await setTestLocale('pt-BR');
    renderWithSuggestion();

    const row = rowOf('Card B');
    expect(within(row).getByRole('button', { name: 'Ver alternativas para Card B (Vermelho)' })).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: /^Usar / })).toBeNull();
    expect(within(row).queryByTestId('missing-row-suggestion')).toBeNull();
    expect(row).not.toHaveTextContent('da sua coleção');
  });

  it('Usar sends the suggestion as a suggested pick', async () => {
    await setTestLocale('pt-BR');
    mockApiFetch.mockReset();
    let finish: (value: unknown) => void = () => undefined;
    mockApiFetch.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
    renderWithSuggestion();
    const use = () => within(rowOf('Card A')).getByRole('button', { name: /^Usar Erase Face/ });

    await userEvent.click(use());

    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    const [path, init] = mockApiFetch.mock.calls[0]!;
    expect(path).toBe(`/decks/${DECK_ID}/replacements`);
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      originalCardIdentifier: 'card-a',
      slot: 'mainboard',
      replacementCardIdentifier: 'erase-face-red',
      pickedFrom: 'suggested',
    });
    expect(use()).toBeDisabled();
    finish({ replacement: {} });
    await waitFor(() => expect(use()).toBeEnabled());

    mockApiFetch.mockRejectedValueOnce(new ApiError(409, JSON.stringify({ code: 'NOTHING_TO_REPLACE', message: 'server text' })));
    await userEvent.click(use());
    expect(await within(rowOf('Card A')).findByTestId('missing-row-use-error')).toHaveTextContent(
      'Esta carta não tem mais cópias faltando para substituir.',
    );
  });
});

describe('MissingPanel — share call to action', () => {
  it('shows when cards are unavailable at the store and opens the share dialog on that click', async () => {
    const onShareMissing = vi.fn();
    renderPanel(populated(), { onShareMissing });

    const callout = screen.getByTestId('missing-share-callout');
    expect(callout).toHaveTextContent('2 cartas não estão na loja.');
    await userEvent.click(within(callout).getByRole('button', { name: 'Pedir nos grupos' }));
    expect(onShareMissing).toHaveBeenCalledTimes(1);
  });

  it('is absent when the store has every missing card', () => {
    renderPanel(
      populated({ lines: [line({}), line({ cardIdentifier: 'card-b', cardName: 'Card B', quantityNeeded: 2, quantityAvailable: 2 })] }),
      { onShareMissing: vi.fn() },
    );
    expect(screen.queryByTestId('missing-share-callout')).toBeNull();
  });

  it('is absent without store data, since nothing is known about availability', () => {
    renderPanel({ kind: 'unscraped' }, { onShareMissing: vi.fn() });
    expect(screen.queryByTestId('missing-share-callout')).toBeNull();
  });

  it('is absent when nothing is missing', () => {
    renderPanel(populated(), { onShareMissing: vi.fn(), entries: [] });
    expect(screen.queryByTestId('missing-share-callout')).toBeNull();
  });
});

describe('MissingPanel: card names carry the pitch', () => {
  const PACK_HUNT_RED = entry({ cardIdentifier: 'pack-hunt-red', name: 'Pack Hunt', quantity: 1, pitch: 1 });
  const PACK_HUNT_BLUE = entry({ cardIdentifier: 'pack-hunt-blue', name: 'Pack Hunt', quantity: 1, pitch: 3 });

  it('two pitches of one name read differently', () => {
    renderPanel(
      populated({
        lines: [
          line({ cardIdentifier: 'pack-hunt-red', cardName: 'Pack Hunt', pitch: 1, quantityNeeded: 1, quantityAvailable: 1 }),
          line({ cardIdentifier: 'pack-hunt-blue', cardName: 'Pack Hunt', pitch: 3, quantityNeeded: 1, quantityAvailable: 1 }),
        ],
      }),
      { entries: [PACK_HUNT_RED, PACK_HUNT_BLUE] },
    );

    const names = screen.getAllByTestId('missing-row').map((row) => row.querySelector(`.${styles.name}`)?.textContent);
    expect(names).toEqual(['Pack Hunt (Vermelho)', 'Pack Hunt (Azul)']);
    expect(screen.getByRole('link', { name: 'Comprar Pack Hunt (Vermelho) na loja' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Comprar Pack Hunt (Azul) na loja' })).toBeInTheDocument();
  });

  it('a card with no pitch is named alone', () => {
    renderPanel(
      populated({
        lines: [line({ cardIdentifier: 'dawnblade', cardName: 'Dawnblade', pitch: null, quantityNeeded: 1, quantityAvailable: 1 })],
      }),
      { entries: [entry({ cardIdentifier: 'dawnblade', name: 'Dawnblade', quantity: 1, slot: 'weapon', pitch: null })] },
    );

    const row = screen.getByTestId('missing-row');
    expect(row.querySelector(`.${styles.name}`)?.textContent).toBe('Dawnblade');
    expect(within(row).getByRole('link', { name: 'Comprar Dawnblade na loja' })).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Já tenho Dawnblade' })).toBeInTheDocument();
  });
});

describe('the missing list page', () => {
  it('the missing list splits and filters by side', async () => {
    const lines = [
      missingLine({ cardIdentifier: 'a', name: 'Alpha', deckNeeded: 3, deckQuantity: 3, availableCopies: 3, lineCents: 300 }),
      missingLine({ cardIdentifier: 'b', name: 'Bravo', deckNeeded: 1, deckQuantity: 1, availableCopies: 1, lineCents: 100 }),
      missingLine({ cardIdentifier: 'c', name: 'Charlie', deckNeeded: 0, inventoryNeeded: 2, deckQuantity: 2, availableCopies: 2, lineCents: 200 }),
      missingLine({ cardIdentifier: 'd', name: 'Delta', deckNeeded: 0, inventoryNeeded: 1, deckQuantity: 1, availableCopies: 1, lineCents: 100 }),
    ];
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === '/decks/7/missing') return missingResponse(lines, { buyCopies: 7 });
      return { id: 7, name: 'Deck', hero: 'Rhinar' };
    });
    // The rows read as sentences on a phone, where the list is a stack of cards.
    window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() });
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MissingListPage deckId={7} />
      </QueryClientProvider>,
    );

    const page = await screen.findByTestId('missing-list-page');
    const head = 'Faltam 7 cópias de 4 cartas · 4 do deck, 3 do inventário';
    expect(page).toHaveTextContent(head);
    expect(screen.getByRole('button', { name: 'Todas' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Do deck' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Do inventário' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getAllByTestId('missing-row')).toHaveLength(4);
    const charlie = screen.getAllByTestId('missing-row').find((row) => row.textContent?.includes('Charlie'));
    expect(charlie).toHaveTextContent('faltam 2 · 2 do inventário');

    fireEvent.click(screen.getByRole('button', { name: 'Do inventário' }));

    const names = screen.getAllByTestId('missing-row').map((row) => row.textContent?.match(/Alpha|Bravo|Charlie|Delta/)?.[0]);
    expect(names).toEqual(['Charlie', 'Delta']);
    expect(screen.getByTestId('missing-head')).toHaveTextContent(head);

    fireEvent.click(screen.getByRole('button', { name: 'Do deck' }));

    expect(screen.getAllByTestId('missing-row')).toHaveLength(2);
    expect(screen.getByTestId('missing-head')).toHaveTextContent(head);
    Reflect.deleteProperty(window, 'matchMedia');
  });
});
