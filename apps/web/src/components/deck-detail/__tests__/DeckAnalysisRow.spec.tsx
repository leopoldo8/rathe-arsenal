import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { withLinkMock } from '../../../test/router-link-mock';

vi.mock('@tanstack/react-router', async (importOriginal) => withLinkMock(await importOriginal<object>()));

import { GlossaryScope } from '../../glossary/GlossaryScope';
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
});
