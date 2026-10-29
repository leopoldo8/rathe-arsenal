import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { MissingListRow } from '../MissingListRow';
import { MissingSummary } from '../MissingSummary';
import { useMissingListQuery } from '../../../api/missing-list';
import { line, Providers, response, SEARCH_BASE, summary } from './missingListKit';

const api = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('../../../lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/api-client')>()),
  useApiClient: () => api.fetch,
}));
vi.mock('../../ui/Toast/useToast', () => ({ useToast: () => ({ show: vi.fn() }) }));

function renderRow(overrides: Parameters<typeof line>[0], layout: 'card' | 'table' = 'card'): HTMLElement {
  const { container } = render(
    <Providers>
      {layout === 'card' ? (
        <ul>
          <MissingListRow deckId={7} line={line(overrides)} layout="card" />
        </ul>
      ) : (
        <table>
          <tbody>
            <MissingListRow deckId={7} line={line(overrides)} layout="table" />
          </tbody>
        </table>
      )}
    </Providers>,
  );
  return container;
}

beforeEach(() => {
  api.fetch.mockReset();
});

describe('MissingListRow', () => {
  it('each store state has its own row copy', () => {
    const bloodrush = { cardIdentifier: 'bloodrush-bellow-yellow', name: 'Bloodrush Bellow', pitch: 2 as const };

    const priced = renderRow({
      ...bloodrush,
      deckNeeded: 3,
      unitPriceCents: 6999,
      lineCents: 13998,
      availableCopies: 2,
      foilOnly: true,
      promoOnly: true,
    });
    expect(priced).toHaveTextContent('faltam 3 · R$ 69,99 cada');
    expect(priced).toHaveTextContent('R$ 139,98');
    expect(priced).toHaveTextContent('só tem foil promo');
    expect(priced).toHaveTextContent('A loja tem 2. A 3ª está no pedido do grupo.');
    expect(within(priced).getByRole('button', { name: 'Já tenho Bloodrush Bellow (Amarelo)' })).toHaveTextContent('Já tenho…');
    const buy = within(priced).getByRole('link', { name: /Bloodrush Bellow \(Amarelo\)/ });
    expect(buy).toHaveTextContent('Comprar');
    expect(buy).toHaveTextContent('Comprar ↗');
    expect(buy).toHaveAccessibleName('Comprar Bloodrush Bellow (Amarelo) no site da Cúpula DT');
    expect(buy).toHaveAttribute('target', '_blank');
    expect(buy.getAttribute('rel')).toContain('noopener');
    expect(buy).toHaveAttribute('href', 'https://store.test/pack-hunt');
    expect(priced).not.toHaveTextContent('não tem esta carta');
    document.body.innerHTML = '';

    const foilOnly = renderRow({ foilOnly: true });
    expect(foilOnly).toHaveTextContent('só tem foil');
    expect(foilOnly).not.toHaveTextContent('foil promo');
    document.body.innerHTML = '';

    const lookingUp = renderRow({ state: 'looking_up', unitPriceCents: null, lineCents: null, availableCopies: null, productUrl: null });
    expect(lookingUp).toHaveTextContent('buscando preço…');
    expect(lookingUp).not.toHaveTextContent('R$');
    expect(within(lookingUp).queryByRole('link')).toBeNull();
    expect(lookingUp).not.toHaveTextContent('não tem esta carta');
    document.body.innerHTML = '';

    const noPrice = renderRow({ state: 'no_price', unitPriceCents: null, lineCents: null, availableCopies: null });
    expect(noPrice).toHaveTextContent('sem preço agora · ver na loja');
    expect(within(noPrice).getByRole('link', { name: /Pack Hunt \(Vermelho\)/ })).toHaveAttribute('href', 'https://store.test/pack-hunt');
    expect(noPrice).not.toHaveTextContent('não tem esta carta');
    document.body.innerHTML = '';

    const search = `${SEARCH_BASE}${encodeURIComponent('Snapdragon Scalers')}`;
    const offSite = renderRow({
      cardIdentifier: 'snapdragon-scalers',
      name: 'Snapdragon Scalers',
      pitch: null,
      state: 'not_on_site',
      deckNeeded: 1,
      unitPriceCents: null,
      lineCents: null,
      availableCopies: null,
      productUrl: null,
      searchUrl: search,
    });
    expect(offSite).toHaveTextContent('O app não achou esta carta no site da Cúpula DT · procurar lá');
    expect(within(offSite).getByRole('link', { name: /Snapdragon Scalers/ })).toHaveAttribute('href', search);
    expect(offSite).not.toHaveTextContent('não tem esta carta');
    document.body.innerHTML = '';

    const stillLooking = [line({ cardIdentifier: 'a' }), line({ cardIdentifier: 'b', state: 'looking_up', deckNeeded: 2, unitPriceCents: null, lineCents: null, availableCopies: null })];
    render(<MissingSummary summary={summary({ buyCopies: 3, buyCents: 60, lookingUp: 1 })} lines={stillLooking} />);
    expect(screen.getByTestId('missing-summary')).toHaveTextContent('Falta comprar: 3 cópias · R$ 0,60 na Cúpula DT');
    expect(screen.getByText('1 cartas ainda buscando preço')).toBeInTheDocument();
    document.body.innerHTML = '';

    const lacks = renderRow({ state: 'store_lacks', unitPriceCents: null, lineCents: null, availableCopies: null });
    expect(lacks).toHaveTextContent('A Cúpula DT não tem esta carta agora');
  });

  it('an unused stand-in is offered inline', () => {
    const container = renderRow({
      cardIdentifier: 'bloodrush-bellow-yellow',
      name: 'Bloodrush Bellow',
      pitch: 2,
      deckNeeded: 3,
      unitPriceCents: 6999,
      lineCents: 20997,
      availableCopies: 3,
      standIn: { cardIdentifier: 'bloodrush-bellow-red', name: 'Bloodrush Bellow', pitch: 1, copies: 1, savingCents: 6999, used: false, replacementId: null },
    });

    expect(container).toHaveTextContent('faltam 3 · R$ 69,99 cada');
    expect(container).toHaveTextContent('R$ 209,97');
    expect(container).toHaveTextContent('Você tem 1 Bloodrush Bellow (Vermelho), que serve no lugar de 1 · economiza R$ 69,99');
    expect(within(container).getByRole('button', { name: /^Usar Bloodrush Bellow \(Vermelho\)/ })).toHaveTextContent('Usar');
  });

  it('Usar sends the copies the stand-in covers and Desfazer reverts', async () => {
    api.fetch.mockResolvedValue({ replacement: {} });
    const unused = {
      cardIdentifier: 'alpha-rampage-red',
      name: 'Alpha Rampage',
      pitch: 1 as const,
      deckNeeded: 3,
      unitPriceCents: 15000,
      lineCents: 45000,
      availableCopies: 3,
      standIn: { cardIdentifier: 'awakening-bellow-red', name: 'Awakening Bellow', pitch: 1 as const, copies: 2, savingCents: 30000, used: false, replacementId: null },
    };
    const { rerender } = render(
      <Providers>
        <ul>
          <MissingListRow deckId={7} line={line(unused)} />
        </ul>
      </Providers>,
    );

    fireEvent.click(screen.getByRole('button', { name: /^Usar Awakening Bellow \(Vermelho\)/ }));

    await waitFor(() => expect(api.fetch).toHaveBeenCalledTimes(1));
    expect(api.fetch.mock.calls[0]![0]).toBe('/decks/7/replacements');
    expect(JSON.parse(api.fetch.mock.calls[0]![1].body as string)).toEqual({
      originalCardIdentifier: 'alpha-rampage-red',
      slot: 'mainboard',
      replacementCardIdentifier: 'awakening-bellow-red',
      pickedFrom: 'suggested',
      quantity: 2,
    });

    rerender(
      <Providers>
        <ul>
          <MissingListRow
            deckId={7}
            line={line({
              ...unused,
              deckNeeded: 1,
              lineCents: 15000,
              availableCopies: 1,
              standIn: { ...unused.standIn, used: true, replacementId: 'r1' },
            })}
          />
        </ul>
      </Providers>,
    );
    expect(screen.getByTestId('missing-stand-in')).toHaveTextContent(
      'Você vai usar 2 Awakening Bellow (Vermelho), que já tem, no lugar de 2 · economiza R$ 300,00',
    );

    fireEvent.click(screen.getByRole('button', { name: /^Desfazer a troca de Alpha Rampage/ }));

    await waitFor(() => expect(api.fetch).toHaveBeenCalledTimes(2));
    expect(api.fetch.mock.calls[1]![0]).toBe('/replacements/r1/revert');
    expect(api.fetch.mock.calls[1]![1].method).toBe('POST');
  });

  it('Usar sends the copies the stand-in covers and Desfazer reverts: the row follows the server and returns to Usar', async () => {
    let used = false;
    const base = {
      cardIdentifier: 'alpha-rampage-red',
      name: 'Alpha Rampage',
      pitch: 1 as const,
      unitPriceCents: 15000,
    };
    const rowFromServer = () =>
      line({
        ...base,
        deckNeeded: used ? 1 : 3,
        lineCents: used ? 15000 : 45000,
        availableCopies: used ? 1 : 3,
        standIn: { cardIdentifier: 'awakening-bellow-red', name: 'Awakening Bellow', pitch: 1, copies: 2, savingCents: 30000, used, replacementId: used ? 'r1' : null },
      });
    api.fetch.mockImplementation(async (path: string, init?: { method?: string }) => {
      if (path === '/decks/7/missing') return response([rowFromServer()]);
      if (path === '/decks/7/replacements' && init?.method === 'POST') {
        used = true;
        return { replacement: {} };
      }
      if (path === '/replacements/r1/revert' && init?.method === 'POST') {
        used = false;
        return { replacement: {} };
      }
      throw new Error(`unhandled ${path}`);
    });
    function ListFromServer(): React.ReactElement | null {
      const { data } = useMissingListQuery(7);
      return data === undefined ? null : (
        <ul>
          {data.lines.map((entry) => (
            <MissingListRow key={entry.cardIdentifier} deckId={7} line={entry} />
          ))}
        </ul>
      );
    }
    render(
      <Providers>
        <ListFromServer />
      </Providers>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /^Usar Awakening Bellow \(Vermelho\)/ }));

    await waitFor(() =>
      expect(screen.getByTestId('missing-stand-in')).toHaveTextContent(
        'Você vai usar 2 Awakening Bellow (Vermelho), que já tem, no lugar de 2 · economiza R$ 300,00',
      ),
    );
    expect(screen.getByRole('button', { name: /^Desfazer a troca de Alpha Rampage/ })).toHaveTextContent('Desfazer');
    expect(screen.getByTestId('missing-row')).toHaveTextContent('falta 1 · R$ 150,00');
    expect(screen.getByTestId('missing-row')).toHaveTextContent('R$ 150,00');

    fireEvent.click(screen.getByRole('button', { name: /^Desfazer a troca de Alpha Rampage/ }));

    expect(await screen.findByRole('button', { name: /^Usar Awakening Bellow \(Vermelho\)/ })).toHaveTextContent('Usar');
    expect(screen.queryByRole('button', { name: /^Desfazer/ })).toBeNull();
    expect(screen.getByTestId('missing-row')).toHaveTextContent('faltam 3');
    expect(screen.getByTestId('missing-row')).toHaveTextContent('R$ 450,00');
  });

  it('shows the table row of the desktop list with its columns', () => {
    const container = renderRow({ deckNeeded: 3, inventoryNeeded: 0, unitPriceCents: 20, lineCents: 60 }, 'table');

    const cells = within(container).getAllByRole('cell');
    expect(cells).toHaveLength(7);
    expect(cells[1]).toHaveTextContent('3');
    expect(cells[4]).toHaveTextContent('R$ 0,20');
    expect(cells[5]).toHaveTextContent('R$ 0,60');
    expect(within(cells[2]!).getAllByRole('button')).toHaveLength(4);
    expect(within(cells[6]!).getByRole('link')).toHaveTextContent('Comprar');
  });

  it('a row has the Alternativas link under the name line and above the notice and buttons', () => {
    const row = renderRow({
      cardIdentifier: 'bloodrush-bellow-yellow',
      name: 'Bloodrush Bellow',
      pitch: 2,
      deckNeeded: 3,
      unitPriceCents: 6999,
      lineCents: 20997,
      availableCopies: 2,
    });

    const link = within(row).getByRole('button', { name: 'Ver alternativas para Bloodrush Bellow (Amarelo)' });
    expect(link).toHaveTextContent('Alternativas');
    expect(within(row).getAllByRole('button', { name: /^Ver alternativas/ })).toHaveLength(1);
    const meta = within(row).getByText('faltam 3', { exact: false }).closest('p') as HTMLElement;
    const notice = within(row).getByText('A loja tem 2. A 3ª está no pedido do grupo.');
    const have = within(row).getByRole('button', { name: 'Já tenho Bloodrush Bellow (Amarelo)' });
    const buy = within(row).getByRole('link', { name: /Comprar Bloodrush Bellow/ });
    const follows = (first: Node, second: Node): boolean => Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(follows(meta, link)).toBe(true);
    expect(follows(link, notice)).toBe(true);
    expect(follows(link, have)).toBe(true);
    expect(follows(have, buy)).toBe(true);
  });

  it('a table row of the desktop list has the Alternativas link under the card name', () => {
    const row = renderRow({ cardIdentifier: 'pack-hunt-red', name: 'Pack Hunt', pitch: 1, deckNeeded: 3 }, 'table');

    const link = within(row).getByRole('button', { name: 'Ver alternativas para Pack Hunt (Vermelho)' });
    expect(link).toHaveTextContent('Alternativas');
    expect(link.closest('td')).toBe(within(row).getByText('Pack Hunt (Vermelho)').closest('td'));
  });

  it('a card with no copy to buy has no Alternativas link', () => {
    const row = renderRow({ deckNeeded: 0, inventoryNeeded: 0, ownedTotal: 3 });

    expect(within(row).queryByRole('button', { name: /^Ver alternativas/ })).toBeNull();
  });
});
