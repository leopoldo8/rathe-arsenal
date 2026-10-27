import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { withLinkMock } from '../../../test/router-link-mock';

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...withLinkMock(await importOriginal<object>()),
  useNavigate: () => vi.fn(),
}));
const apiFetch = vi.hoisted(() => ({ current: vi.fn() }));
vi.mock('../../../lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/api-client')>();
  return { ...actual, useApiClient: () => (path: string, init?: RequestInit) => apiFetch.current(path, init) };
});
vi.mock('../../../auth/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'a@b.com', role: 'user', chatAccess: false } }),
}));
vi.mock('../TagChipRow', () => ({ TagChipRow: () => <div data-testid="tag-row" /> }));
vi.mock('../recommendations/RecommendationsRail', () => ({ RecommendationsRail: () => <section /> }));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../ui/Toast/ToastProvider';
import { GlossaryScope } from '../../glossary/GlossaryScope';
import { createDeckServer, deckFetch, DeckPageHarness } from './deckPageKit';
import { legalityOfComposition, rhinarBlitzDeck } from './ruleChangedFixture';
import type { IDeckDetailResponse, IDeckDetailSnapshot } from '../../../api/deck-detail';
import { DeckAnalysisRow } from '../DeckAnalysisRow';
import { buildDeckList } from '../deckListModel';
import { breakdown, entry } from './deckDetailTestData';

// The deck of r2-pitch-sheet-phone: 31 cards, 14 red, 9 yellow, 8 blue, and the cost bars 11, 7, 9, 4, 0.
const ITEMS = buildDeckList(
  breakdown({
    exact: [
      entry({ cardIdentifier: 'a', name: 'A', pitch: 1, cost: 0, quantity: 11 }),
      entry({ cardIdentifier: 'b', name: 'B', pitch: 1, cost: 1, quantity: 3 }),
      entry({ cardIdentifier: 'c', name: 'C', pitch: 2, cost: 1, quantity: 4 }),
      entry({ cardIdentifier: 'd', name: 'D', pitch: 2, cost: 2, quantity: 5 }),
      entry({ cardIdentifier: 'e', name: 'E', pitch: 3, cost: 2, quantity: 4 }),
      entry({ cardIdentifier: 'f', name: 'F', pitch: 3, cost: 3, quantity: 4 }),
    ],
  }),
  [],
);

const PITCH_SENTENCE =
  'O número de 1 a 3 da carta, mostrado também pela cor: vermelha vale 1, amarela 2, azul 3. Para pagar o custo de uma carta, você descarta outras da mão, e cada uma paga o número do seu pitch.';

function renderRow(): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query.includes('max-width'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
  render(
    <GlossaryScope>
      <DeckAnalysisRow items={ITEMS} />
    </GlossaryScope>,
  );
}

describe('DeckAnalysisRow', () => {
  it('matches r2-pitch-sheet-phone', async () => {
    renderRow();

    const pitch = screen.getByTestId('analysis-pitch');
    expect(within(pitch).getByRole('heading', { name: /^Pitch/ })).toHaveTextContent('Pitch');
    expect(within(pitch).getByRole('button', { name: 'O que é Pitch?' })).toBeInTheDocument();
    expect(within(pitch).getByRole('list')).toHaveTextContent('Vermelho 14 · Amarelo 9 · Azul 8');

    const cost = screen.getByTestId('analysis-cost');
    expect(within(cost).getByRole('heading', { name: /^Curva de custo/ })).toHaveTextContent('Curva de custo');
    expect(within(cost).getByRole('button', { name: 'O que é Curva de custo?' })).toBeInTheDocument();
    const bars = within(cost)
      .getAllByRole('listitem')
      .map((bar) => bar.getAttribute('aria-label')?.replace(/ cartas?$/, ''));
    expect(bars).toEqual(['Custo 0: 11', 'Custo 1: 7', 'Custo 2: 9', 'Custo 3: 4', 'Custo 4+: 0']);

    await userEvent.click(within(pitch).getByRole('button', { name: 'O que é Pitch?' }));

    const sheet = await screen.findByRole('dialog', { name: 'Pitch' });
    expect(Array.from(sheet.querySelectorAll('h2, p, a, button')).map((node) => node.textContent)).toEqual([
      'Pitch',
      PITCH_SENTENCE,
      'No seu deck: 14 vermelhas, 9 amarelas, 8 azuis.',
      'Ver todos os termos',
      'Fechar',
    ]);
  });

  it('opens the sheet of each analysis word apart from the other', async () => {
    renderRow();

    await userEvent.click(screen.getByRole('button', { name: 'O que é Curva de custo?' }));

    const sheet = await screen.findByRole('dialog', { name: 'Curva de custo' });
    expect(sheet).toHaveTextContent('Quantas cartas do deck custam 0, 1, 2, 3 ou mais. Mostra se o deck está pesado ou leve.');
    expect(within(sheet).queryByTestId('glossary-own-line')).toBeNull();
  });

  it('matches r2-pitch-sheet-phone: the deck header, its size line and the analysis of a 31 card deck', async () => {
    // The deck of the screen: "Rhinar - Blitz", stage Montando, 31 of 40 cards.
    const base = rhinarBlitzDeck({ status: 'building' });
    const deck = {
      ...base,
      name: 'Rhinar - Blitz',
      totalCards: 31,
      legality: legalityOfComposition(31, []),
      latestSnapshot: { ...base.latestSnapshot, breakdown: { ...base.latestSnapshot!.breakdown, exact: ITEMS.map((item) => item.entry) } } as IDeckDetailSnapshot,
    } as IDeckDetailResponse;
    apiFetch.current = deckFetch(createDeckServer(deck));
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({ matches: query.includes('max-width'), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }),
    });
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ToastProvider>
          <GlossaryScope>
            <DeckPageHarness deckId={1} />
          </GlossaryScope>
        </ToastProvider>
      </QueryClientProvider>,
    );

    const title = await screen.findByRole('heading', { level: 1, name: 'Rhinar - Blitz' });
    const header = screen.getByRole('region', { name: 'Cabeçalho do deck' });
    expect(header).toContainElement(title);
    expect(within(header).getByText('Blitz', { exact: true })).toBeInTheDocument();
    expect(within(header).getAllByText(/Montando/).length).toBeGreaterThan(0);
    const countLine = screen.getByText('31 de 40 cartas no deck · coloque mais 9');
    const pitch = screen.getByTestId('analysis-pitch');
    const cost = screen.getByTestId('analysis-cost');
    expect(within(pitch).getByRole('heading', { name: /^Pitch/ })).toBeInTheDocument();
    expect(within(cost).getByRole('heading', { name: /^Curva de custo/ })).toBeInTheDocument();
    // Top to bottom: the header with its chips, the size line, Pitch, Curva de custo.
    for (const [before, after] of [
      [title, countLine],
      [header, countLine],
      [countLine, pitch],
      [pitch, cost],
    ] as const) {
      expect(before.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(screen.getAllByText('31 de 40 cartas no deck · coloque mais 9'), 'the size line shows once on the page').toHaveLength(1);
    expect(within(screen.getByTestId('deck-list')).queryByText('31 de 40 cartas no deck · coloque mais 9')).toBeNull();
  });
});
