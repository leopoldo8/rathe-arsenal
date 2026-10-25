import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ISharedCard, ISharedDeckResponse } from '../../../api/shared-decks';
import { createFakeApi, makeAuth, renderWithProviders, SIGNED_IN_USER, type IFakeApi } from './sharingTestKit';

const apiRef = vi.hoisted(() => ({ current: null as IFakeApi | null }));

vi.mock('../../../lib/auth-fetch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/auth-fetch')>();
  return { ...actual, authFetch: (...args: Parameters<IFakeApi['authFetch']>) => apiRef.current!.authFetch(...args) };
});
vi.mock('../../ui/Toast/useToast', () => ({ useToast: () => ({ show: vi.fn() }) }));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, className }: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));

import { SharedMissingPage } from '../SharedMissingPage';

function card(overrides: Partial<ISharedCard> & Pick<ISharedCard, 'cardIdentifier' | 'name' | 'quantity' | 'state'>): ISharedCard {
  return { pitch: null, type: 'Action', slot: 'mainboard', imageUrl: null, availableCopies: null, owned: null, ...overrides };
}

const MISSING: readonly ISharedCard[] = [
  card({ cardIdentifier: 'reckless-swing-blue', name: 'Reckless Swing', pitch: 3, quantity: 3, state: 'store_lacks' }),
  card({ cardIdentifier: 'nullrune-hood', name: 'Nullrune Hood', quantity: 1, state: 'not_on_site' }),
  card({
    cardIdentifier: 'bloodrush-bellow-yellow',
    name: 'Bloodrush Bellow',
    pitch: 2,
    quantity: 3,
    state: 'priced',
    availableCopies: 2,
    unitPriceCents: 6999,
    lineCents: 13998,
    productUrl: 'https://www.cupuladt.com.br/?view=ecom/item&id=1',
  }),
  card({
    cardIdentifier: 'alpha-rampage-red',
    name: 'Alpha Rampage',
    pitch: 1,
    quantity: 1,
    state: 'priced',
    availableCopies: 1,
    unitPriceCents: 15000,
    lineCents: 15000,
    foilOnly: true,
    promoOnly: true,
    productUrl: 'https://www.cupuladt.com.br/?view=ecom/item&id=2',
  }),
  card({ cardIdentifier: 'pack-hunt-red', name: 'Pack Hunt', pitch: 1, quantity: 3, state: 'looking_up', productUrl: 'https://www.cupuladt.com.br/?view=ecom/item&id=3' }),
];

const DECK = {
  intent: 'missing',
  token: 'mQ8rZ3nUp2bX5yKdFgHjLs',
  url: 'https://rathearsenal.app/d/mQ8rZ3nUp2bX5yKdFgHjLs',
  name: '[CC] Brute do Caio',
  hero: 'Rhinar, Reckless Rampage',
  heroIdentifier: null,
  heroCard: null,
  format: 'Classic Constructed',
  sharerName: 'Caio',
  isOwner: false,
  updatedAt: '2026-10-18T12:00:00Z',
  totalCards: 0,
  cards: [],
  missing: MISSING,
  missingCount: 11,
  storeSummary: { copies: 3, cents: 28998 },
  contactWhatsapp: '5551999990000',
  deckId: null,
  legality: null,
} as unknown as ISharedDeckResponse;

describe('SharedMissingPage', () => {
  beforeEach(() => {
    apiRef.current = createFakeApi();
  });

  it('the group page puts what people can give first and the store second', async () => {
    renderWithProviders(<SharedMissingPage deck={DECK} />, makeAuth({ user: null }));
    const user = userEvent.setup();

    const eyebrow = screen.getByText('Lista de cartas');
    const title = screen.getByRole('heading', { level: 1, name: 'Cartas que Caio procura' });
    const deckName = screen.getByText('[CC] Brute do Caio');
    const hint = screen.getByText('Cada cor é uma carta diferente: confira a cor no nome.');
    const giveTitle = screen.getByRole('heading', { name: 'Quem tiver, fala com Caio' });
    const giveHint = screen.getByText('5 cópias que a loja não tem ou que o app não achou no site.');
    const storeButton = screen.getByRole('button', { name: /O resto dá para comprar na Cúpula DT/ });
    const storeSummary = screen.getByText('3 cópias · R$ 289,98 · envia para todo o Brasil');
    const copy = screen.getByRole('button', { name: 'Copiar lista em texto' });
    const footer = screen.getByTestId('shared-deck-footer');
    const inOrder = [eyebrow, title, deckName, hint, giveTitle, giveHint, storeButton, storeSummary, copy, footer];
    inOrder.slice(1).forEach((node, index) => {
      expect(inOrder[index]!.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING, `block ${index + 1} follows block ${index}`).toBeTruthy();
    });

    // The first section names every card the store cannot supply in full, with the copies it cannot.
    const rows = screen.getAllByTestId('shared-card');
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Reckless Swing (Azul)'),
      expect.stringContaining('Nullrune Hood'),
      expect.stringContaining('Bloodrush Bellow (Amarelo)'),
    ]);
    expect(within(rows[0]!).getByText('3 cópias')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('1 cópia')).toBeInTheDocument();
    expect(within(rows[2]!).getByText('1 cópia')).toBeInTheDocument();
    for (const row of rows) expect(within(row).getByRole('button', { name: /^Oferecer / })).toBeInTheDocument();
    expect(screen.queryByText(/Você tem/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('shared-signup-prompt')).not.toBeInTheDocument();

    // The store section is collapsed: its rows appear when it opens.
    expect(storeButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('shared-store-row')).not.toBeInTheDocument();
    await user.click(storeButton);
    expect(storeButton).toHaveAttribute('aria-expanded', 'true');
    const storeRows = screen.getAllByTestId('shared-store-row');
    expect(storeRows).toHaveLength(3);
    expect(within(storeRows[0]!).getByText('R$ 139,98')).toBeInTheDocument();
    expect(within(storeRows[0]!).getByText('A loja tem 2. A 3ª está no pedido do grupo.')).toBeInTheDocument();
    expect(within(storeRows[0]!).getByRole('link', { name: /^Comprar Bloodrush Bellow/ })).toHaveAttribute('href', 'https://www.cupuladt.com.br/?view=ecom/item&id=1');
    expect(within(storeRows[1]!).getByText('só tem foil promo')).toBeInTheDocument();
    expect(within(storeRows[2]!).getByText(/a loja tem · preço no site/)).toBeInTheDocument();
    expect(within(storeRows[2]!).queryByText(/R\$/)).not.toBeInTheDocument();

    // The foot carries the fan-content disclaimer, its copyright line and the price note.
    expect(footer).toHaveTextContent('Legend Story Studios');
    expect(footer).toHaveTextContent('Os preços são da Cúpula DT e podem mudar. Esta página não aparece em buscas.');
  });

  it('a signed-in visitor sees what they have', () => {
    const owned = MISSING.map((entry) =>
      entry.cardIdentifier === 'reckless-swing-blue' ? { ...entry, owned: 3 } : entry.cardIdentifier === 'nullrune-hood' ? { ...entry, owned: 1 } : { ...entry, owned: 0 },
    );
    renderWithProviders(<SharedMissingPage deck={{ ...DECK, missing: owned }} />, makeAuth({ user: { ...SIGNED_IN_USER, id: 'visitor' } }));

    expect(screen.getByText('Você tem 4 cópias de 2 cartas que Caio procura.')).toBeInTheDocument();
    const rows = screen.getAllByTestId('shared-card');
    expect(within(rows[0]!).getByText('Você tem 3')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('Você tem 1')).toBeInTheDocument();
    expect(within(rows[2]!).queryByText(/Você tem/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Oferecer as 2 cartas que você tem' })).toBeInTheDocument();
  });

  it('the owner sees no offer on their own page', () => {
    renderWithProviders(
      <SharedMissingPage deck={{ ...DECK, isOwner: true, deckId: 7, missing: MISSING.map((entry) => ({ ...entry, owned: null })) }} />,
      makeAuth(),
    );

    expect(screen.getAllByTestId('shared-card')).toHaveLength(3);
    expect(screen.queryByRole('button', { name: /Oferecer/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Você tem/)).not.toBeInTheDocument();
  });

  it('says nothing is missing when the owner has every copy', () => {
    renderWithProviders(<SharedMissingPage deck={{ ...DECK, missing: [], missingCount: 0, storeSummary: { copies: 0, cents: 0 } }} />, makeAuth({ user: null }));

    expect(screen.getByText('Não falta nenhuma carta.')).toBeInTheDocument();
  });
});
