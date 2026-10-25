import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DUDA_ROWS, Providers, RHINAR_CC, RHINAR_SA, KAYO, response, why } from './spareKit';

const api = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('../../../lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/api-client')>()),
  useApiClient: () => api.fetch,
}));

import { WhySpareSheet } from '../WhySpareSheet';
import type { ISpareResponse } from '../../../api/spare';

const PACK_HUNT = DUDA_ROWS.find((entry) => entry.cardIdentifier === 'pack-hunt-blue')!;

function renderSheet(spare: ISpareResponse): void {
  render(
    <Providers>
      <WhySpareSheet spare={spare} row={PACK_HUNT} onBack={vi.fn()} />
    </Providers>,
  );
}

const linesOf = (): string[] => within(screen.getByRole('list')).getAllByRole('listitem').map((item) => item.textContent ?? '');

beforeEach(() => {
  api.fetch.mockReset();
});

describe('WhySpareSheet', () => {
  it('explains the count per format, per deck or once, by rule', () => {
    renderSheet(response());

    const sheet = screen.getByTestId('why-spare-sheet');
    expect(sheet.textContent).toContain('‹ Sobrando');
    expect(screen.getByText('Por que sobra?')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pack Hunt (Azul)' })).toBeInTheDocument();
    expect(linesOf()).toEqual([
      'Você tem6',
      'Ficam nos decks Classic Constructedo deck que mais usa: Kayo CC usa 3, Rhinar CC usa 23',
      'Ficam no Rhinar SA (Silver Age)2',
      'Sobra1',
    ]);
    expect(screen.getByText('Dash ideia não conta: decks Ideia e Aposentado não prendem cartas.')).toBeInTheDocument();
    expect(screen.getByText('Sua regra: você passa cartas entre decks do mesmo formato')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mudar' })).toBeInTheDocument();
  });

  it('shows one row with the deck that uses most under any_deck', () => {
    renderSheet(response({ rule: 'any_deck', why: { 'pack-hunt-blue': why({ held: 3, spare: 3 }) } }));

    expect(linesOf()).toEqual([
      'Você tem6',
      'Ficam no Kayo CCo deck que mais usa: Kayo CC usa 3, Rhinar CC usa 2, Rhinar SA usa 23',
      'Sobra3',
    ]);
    expect(screen.getByText('Sua regra: você passa cartas entre quaisquer decks')).toBeInTheDocument();
  });

  it('shows one row per holding deck under per_deck', () => {
    renderSheet(response({ rule: 'per_deck', why: { 'pack-hunt-blue': why({ held: 7, spare: 0 }) } }));

    expect(linesOf()).toEqual(['Você tem6', 'Ficam no Kayo CC3', 'Ficam no Rhinar CC2', 'Ficam no Rhinar SA2', 'Sobra0']);
  });

  it('names the inventory copies a deck holds', () => {
    renderSheet(
      response({
        rule: 'per_deck',
        why: { 'pack-hunt-blue': why({ holders: [{ ...RHINAR_CC, deck: 3, inventory: 1, use: 4 }], held: 4, spare: 2, notHolding: [] }) },
      }),
    );

    expect(screen.getByText('Rhinar CC usa 3 no deck e 1 no inventário')).toBeInTheDocument();
  });

  it('names every deck that does not count, in the plural', () => {
    renderSheet(
      response({
        why: {
          'pack-hunt-blue': why({
            notHolding: [
              { deckId: 4, deckName: 'Dash ideia', status: 'idea' },
              { deckId: 5, deckName: 'Velho', status: 'retired' },
            ],
          }),
        },
      }),
    );

    expect(screen.getByText('Dash ideia e Velho não contam: decks Ideia e Aposentado não prendem cartas.')).toBeInTheDocument();
  });

  it('Mudar reopens the rule question', async () => {
    renderSheet(response({ rule: 'any_deck' }));

    await userEvent.click(screen.getByRole('button', { name: 'Mudar' }));

    expect(screen.getByTestId('spare-rule-sheet')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Sim, entre quaisquer decks/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Sim, entre decks do mesmo formato/ })).not.toBeChecked();
    expect(screen.getByText('Sobram 24 cópias')).toBeInTheDocument();
    void KAYO;
    void RHINAR_SA;
  });
});
