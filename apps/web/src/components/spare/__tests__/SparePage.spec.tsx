import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DUDA_ROWS, Providers, response, row } from './spareKit';
import type { ISpareResponse } from '../../../api/spare';

const api = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('../../ui/Toast/useToast', () => ({ useToast: () => ({ show: vi.fn() }) }));
vi.mock('../../../lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/api-client')>()),
  useApiClient: () => api.fetch,
}));

import { SparePage } from '../SparePage';

async function renderPage(data: ISpareResponse): Promise<void> {
  api.fetch.mockImplementation(async (path: string) => {
    if (path === '/collection/spare') return data;
    throw new Error(`unhandled ${path}`);
  });
  render(
    <Providers>
      <SparePage onBack={vi.fn()} onSent={vi.fn()} />
    </Providers>,
  );
}

beforeEach(() => {
  api.fetch.mockReset();
});

describe('SparePage (S20)', () => {
  it('shows no rule question when the count does not depend on it', async () => {
    await renderPage(response({ rule: null, needsRule: false, counts: { within_format: 20, any_deck: 20, per_deck: 20 } }));

    expect(await screen.findByTestId('spare-page')).toBeInTheDocument();
    expect(screen.getAllByTestId('spare-row')).toHaveLength(DUDA_ROWS.length);
    expect(screen.queryByText('Antes de contar o que sobra')).toBeNull();
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.queryByText(/Sua regra/)).toBeNull();
  });

  it('asks the rule question instead of any number while it is owed', async () => {
    await renderPage(response({ needsRule: true, rule: null, rows: [], totalSpare: 0 }));

    expect(await screen.findByText('Antes de contar o que sobra')).toBeInTheDocument();
    expect(screen.queryByTestId('spare-row')).toBeNull();
    expect(screen.queryByText(/Sobrando ·/)).toBeNull();
  });
});

const rowsOf = (): HTMLElement[] => screen.getAllByTestId('spare-row');

describe('SparePage (S21)', () => {
  it('shows the spare rows with steppers at 0 and the empty bar', async () => {
    await renderPage(response({ rule: 'within_format' }));

    await screen.findByTestId('spare-page');
    const page = screen.getByTestId('spare-page');
    const text = page.textContent ?? '';
    const inOrder = [
      '‹ Coleção',
      'Sobrando · 20 cópias',
      'Sua regra: você passa cartas entre decks do mesmo formato',
      'Mudar',
      'Dash ideia usa 3 Head Jab. Decks Ideia não prendem cartas, então elas aparecem aqui.',
      'Marcar Dash ideia como Montando',
      'Ordenar:',
      'maior preço',
      'Mostrar:',
      'todas',
      'acima de R$ 5',
      'acima de R$ 20',
    ];
    const positions = inOrder.map((entry) => text.indexOf(entry));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);

    const rows = rowsOf();
    expect(rows).toHaveLength(8);
    expect(rows[0]).toHaveTextContent('Enlightened Strike (Vermelho)');
    expect(rows[0]).toHaveTextContent('Rainbow Foil · NM · 1 sobrando');
    expect(rows[0]).toHaveTextContent('Sugerido R$ 60');
    expect(rows[1]).toHaveTextContent('History Pack 1 · NM · 2 sobrando');
    expect(rows[2]).toHaveTextContent('Versão não informada · 1 sobrando');
    expect(rows[3]).toHaveTextContent(/Snatch \(Vermelho\)2 sobrando/);
    expect(rows[3]).not.toHaveTextContent('Versão não informada');
    for (const row of rows) {
      expect(within(row).getByRole('button', { name: 'Por que sobra?' })).toBeInTheDocument();
      expect(within(row).getByText('Ver na LigaFAB')).toBeInTheDocument();
      expect(within(row).getByRole('status')).toHaveTextContent('0');
      expect(within(row).getByRole('button', { name: /^Menos uma cópia/ })).toBeDisabled();
    }
    const bar = screen.getByTestId('spare-bar');
    expect(bar).toHaveTextContent('Escolha o que vender');
    expect(within(bar).getByRole('button', { name: 'Escolha o que vender' })).toBeDisabled();
  });

  it('steppers stop at the spare and the bar sums the choice', async () => {
    await renderPage(response());
    await screen.findByTestId('spare-page');
    const click = async (index: number, name: RegExp, times: number): Promise<void> => {
      for (let count = 0; count < times; count += 1) await userEvent.click(within(rowsOf()[index]!).getByRole('button', { name }));
    };

    await click(0, /^Mais uma cópia/, 3);
    expect(within(rowsOf()[0]!).getByRole('button', { name: /^Mais uma cópia/ })).toBeDisabled();
    expect(within(rowsOf()[0]!).getByRole('status')).toHaveTextContent('1');
    await click(1, /^Mais uma cópia/, 2);
    await click(2, /^Mais uma cópia/, 1);
    await click(3, /^Mais uma cópia/, 2);
    await click(4, /^Mais uma cópia/, 3);

    const bar = screen.getByTestId('spare-bar');
    expect(bar).toHaveTextContent('Você escolheu 9 cópias');
    expect(bar).toHaveTextContent('9 cópias · R$ 186');
    expect(within(bar).getByRole('button', { name: 'Vender' })).toBeEnabled();
  });

  it('sorts by price or name and filters by price', async () => {
    await renderPage(response());
    await screen.findByTestId('spare-page');
    const names = (): string[] => rowsOf().map((row) => row.querySelector('p')?.textContent ?? '');

    expect(names()).toEqual([
      'Enlightened Strike (Vermelho)',
      'Command and Conquer (Vermelho)',
      'Enlightened Strike (Vermelho)',
      'Snatch (Vermelho)',
      'Pummel (Vermelho)',
      'Head Jab (Vermelho)',
      'Pack Hunt (Azul)',
      'Wounding Blow (Vermelho)',
    ]);

    await userEvent.click(screen.getByRole('button', { name: 'nome' }));
    expect(names()).toEqual([
      'Command and Conquer (Vermelho)',
      'Enlightened Strike (Vermelho)',
      'Enlightened Strike (Vermelho)',
      'Head Jab (Vermelho)',
      'Pack Hunt (Azul)',
      'Pummel (Vermelho)',
      'Snatch (Vermelho)',
      'Wounding Blow (Vermelho)',
    ]);

    await userEvent.click(screen.getByRole('button', { name: 'maior preço' }));
    await userEvent.click(screen.getByRole('button', { name: 'acima de R$ 5' }));
    // R$ 5 or less is hidden: Pummel (4), Head Jab (2), Pack Hunt (2) and Wounding Blow (1).
    expect(names()).toEqual(['Enlightened Strike (Vermelho)', 'Command and Conquer (Vermelho)', 'Enlightened Strike (Vermelho)', 'Snatch (Vermelho)']);

    await userEvent.click(screen.getByRole('button', { name: 'acima de R$ 20' }));
    expect(names()).toEqual(['Enlightened Strike (Vermelho)', 'Command and Conquer (Vermelho)']);

    await userEvent.click(screen.getByRole('button', { name: 'todas' }));
    expect(rowsOf()).toHaveLength(8);
  });

  it('marking the Ideia deck as Montando updates the count', async () => {
    let building = false;
    api.fetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === '/collection/spare') {
        return building ? response({ totalSpare: 17, ideaDecks: [] }) : response();
      }
      if (path === '/decks/4' && init?.method === 'PATCH') {
        building = true;
        return undefined;
      }
      throw new Error(`unhandled ${path}`);
    });
    render(
      <Providers>
        <SparePage onBack={vi.fn()} onSent={vi.fn()} />
      </Providers>,
    );
    await screen.findByText('Sobrando · 20 cópias');

    await userEvent.click(screen.getByRole('button', { name: 'Marcar Dash ideia como Montando' }));

    expect(api.fetch).toHaveBeenCalledWith('/decks/4', { method: 'PATCH', body: JSON.stringify({ status: 'building' }) });
    expect(await screen.findByText('Sobrando · 17 cópias')).toBeInTheDocument();
    expect(screen.queryByTestId('idea-notice')).toBeNull();
  });

  it('the store reference shows only next to unknown or regular versions with a price', async () => {
    const rows = [
      row({ cardIdentifier: 'a', name: 'Alfa', spare: 1, finish: '', storeCents: 800, suggestedCents: 1200 }),
      row({ cardIdentifier: 'b', name: 'Beta', spare: 1, finish: 'none', storeCents: 150, suggestedCents: 600 }),
      row({ cardIdentifier: 'c', name: 'Gama', spare: 1, finish: 'rainbow', storeCents: 900, suggestedCents: 6000 }),
      row({ cardIdentifier: 'd', name: 'Delta', spare: 1, finish: '', storeCents: null, suggestedCents: 400 }),
    ];
    await renderPage(response({ rows, totalSpare: 4 }));
    await screen.findByTestId('spare-page');

    const byName = (name: string): HTMLElement => rowsOf().find((entry) => entry.textContent?.includes(name))!;
    expect(byName('Alfa')).toHaveTextContent('A Cúpula DT vende a versão mais barata por R$ 8,00');
    expect(byName('Beta')).toHaveTextContent('A Cúpula DT vende a versão mais barata por R$ 1,50');
    expect(byName('Gama')).not.toHaveTextContent('A Cúpula DT');
    expect(byName('Delta')).not.toHaveTextContent('A Cúpula DT');
  });

  it("Ver na LigaFAB is on the seller's screens", async () => {
    await renderPage(response());
    await screen.findByTestId('spare-page');

    const links = within(screen.getByRole('list', { name: 'Cartas sobrando' })).getAllByText('Ver na LigaFAB');
    expect(links).toHaveLength(8);
    expect(links[0]!.closest('a')).toHaveAttribute('href', expect.stringContaining('Enlightened%20Strike'));
    expect(links[0]!.closest('a')).toHaveAttribute('target', '_blank');
  });
});
