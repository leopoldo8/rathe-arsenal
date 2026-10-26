import React from 'react';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ICardVersionOptions, ICardVersionPrinting } from '../../../api/collection-versions';
import type { ILibraryCard } from '../../../api/library';

const moveMutate = vi.fn();
const optionsState: { data: ICardVersionOptions | undefined; isError: boolean } = { data: undefined, isError: false };

vi.mock('../../../api/collection-versions', async () => {
  const actual = await vi.importActual<typeof import('../../../api/collection-versions')>(
    '../../../api/collection-versions',
  );
  return {
    ...actual,
    useCardVersionOptionsQuery: () => ({
      data: optionsState.data,
      isLoading: optionsState.data === undefined && !optionsState.isError,
      isError: optionsState.isError,
    }),
    useMoveCopiesMutation: () => ({ mutate: moveMutate, isPending: false, isError: false }),
  };
});

import { CardVersionsSheet } from '../CardVersionsSheet';
import styles from '../CopyVersions.module.css';

function printing(printingCode: string, setName: string, extra: Partial<ICardVersionPrinting> = {}): ICardVersionPrinting {
  return { printingCode, setName, imageUrl: null, editions: [], finishes: ['none'], ...extra };
}

// Snatch (Vermelho) has ten printing codes; the three the screen draws come first.
const SNATCH_OPTIONS: ICardVersionOptions = {
  cardIdentifier: 'snatch-red',
  printings: [
    printing('WTR167', 'Welcome to Rathe', { editions: ['alpha', 'unlimited'], finishes: ['none', 'rainbow'] }),
    printing('1HP371', 'History Pack 1'),
    printing('ASR013', 'Armory Deck: Ira'),
    printing('AST014', 'Armory Deck: Aurora'),
    printing('ASB012', 'Armory Deck: Boltyn'),
    printing('SBA021', 'Briar Silver Age Deck'),
    printing('SBL017', 'Boltyn Silver Age Deck'),
    printing('SFA025', 'Fai Silver Age Deck'),
    printing('ANQ031', 'Promos'),
    printing('FAB331', 'Promos', { finishes: ['rainbow'] }),
  ],
};

const NO_VERSION = { printingCode: '', edition: '', finish: '', condition: '' };
const MARKED = { printingCode: 'WTR167', edition: 'unlimited', finish: 'rainbow', condition: 'NM' };

function snatch(overrides: Partial<ILibraryCard> = {}): ILibraryCard {
  return {
    cardIdentifier: 'snatch-red',
    name: 'Snatch',
    pitch: 1,
    types: ['Action'],
    subtypes: ['Attack'],
    classes: [],
    talents: [],
    sets: ['WTR'],
    imageUrl: null,
    ownedQuantity: 3,
    contributions: [
      { sourceId: 'list', sourceLabel: 'Lista colada', kind: 'csv', quantity: 2, ...NO_VERSION },
      { sourceId: 'list', sourceLabel: 'Lista colada', kind: 'csv', quantity: 1, ...MARKED },
    ],
    ...overrides,
  };
}

function expectInOrder(root: HTMLElement, fragments: readonly string[]): void {
  // Each fragment must appear after the end of the one before it.
  const text = (root.textContent ?? '').replace(/\s+/g, ' ');
  let cursor = 0;
  const found: Array<[string, boolean]> = [];
  for (const fragment of fragments) {
    const at = text.indexOf(fragment, cursor);
    found.push([fragment, at >= 0]);
    if (at >= 0) cursor = at + fragment.length;
  }
  expect(found).toEqual(fragments.map((fragment) => [fragment, true]));
}

beforeEach(() => {
  moveMutate.mockReset();
  optionsState.data = SNATCH_OPTIONS;
  optionsState.isError = false;
});

describe('CardVersionsSheet', () => {
  it('an unknown version is grey text with no badge or call to action', () => {
    render(<CardVersionsSheet card={snatch({ ownedQuantity: 2, contributions: [snatch().contributions[0]!] })} open onClose={vi.fn()} />);

    const unknown = screen.getByText('2 sem versão informada');
    expect(unknown).toHaveClass(styles.muted!);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(unknown.tagName).toBe('LI');
    expect(unknown.children).toHaveLength(0);
    expect(unknown.className).toBe(styles.muted);
    expect(unknown.closest('button, a, [role="button"], [role="status"], [role="img"]')).toBeNull();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['Mudar versão']);
  });

  it('an unknown version is grey text with no badge or call to action: no other surface shows an unversioned count', () => {
    // The Library grid, "Importações" and the deck page never name the unversioned copies:
    // only this sheet and the bulk sheet may use the copy that does.
    const unversionedCopy = /copyVersions\.(noVersion|groupUnknown|bulkApply)/;
    const components = resolve(__dirname, '../..');
    const surfaces = ['library', 'csv-sources', 'deck-detail', 'card-gallery', 'home'];
    const offenders = surfaces.flatMap((folder) =>
      readdirSync(resolve(components, folder), { recursive: true, encoding: 'utf8' })
        .filter((file) => /\.tsx?$/.test(file) && !file.includes('__tests__'))
        .filter((file) => unversionedCopy.test(readFileSync(resolve(components, folder, file), 'utf8')))
        .map((file) => `${folder}/${file}`),
    );

    expect(offenders).toEqual([]);
  });

  it('matches r3-version-card-phone copy and order', async () => {
    const user = userEvent.setup();
    render(<CardVersionsSheet card={snatch()} open onClose={vi.fn()} />);
    const sheet = screen.getByRole('dialog');

    expectInOrder(sheet, [
      'Snatch (Vermelho)',
      '3 cópias',
      '2 sem versão informada',
      '1 Welcome to Rathe · Unlimited · Rainbow Foil · NM',
      'Mudar versão',
    ]);

    await user.click(screen.getByRole('button', { name: 'Mudar versão' }));

    expectInOrder(sheet, [
      'Versão das cópias',
      'Versão',
      'Welcome to Rathe',
      'WTR167',
      'History Pack 1',
      '1HP371',
      'Armory Deck: Ira',
      'ASR013',
      '+ 7 versões',
      'Versão: a coleção e a arte da carta (o código no rodapé, como WTR023)',
      'Edição',
      'Alpha',
      'Unlimited',
      'Edição: 1ª edição, Alpha ou Unlimited, escrito na carta',
      'Foil',
      'Sem foil',
      'Rainbow Foil',
      'Foil: o acabamento brilhante',
      'Estado',
      'NM',
      'LP',
      'MP',
      'HP',
      'Estado: NM quase nova, LP pouco usada, MP usada, HP muito usada',
      'Isso vale para:',
      'as 2 cópias',
      'só 1',
      'Salvar',
    ]);
    expect(screen.getByPlaceholderText('Procurar versão')).toBeInTheDocument();
    // Only what exists for this card: no 1ª edição, no Cold Foil, no DMG, no "Não sei".
    expect(within(sheet).queryByRole('button', { name: '1ª edição' })).not.toBeInTheDocument();
    expect(within(sheet).queryByRole('button', { name: 'Cold Foil' })).not.toBeInTheDocument();
    expect(within(sheet).queryByRole('button', { name: 'DMG' })).not.toBeInTheDocument();
    expect(within(sheet).queryByRole('button', { name: 'Não sei' })).not.toBeInTheDocument();
    // Nothing is pre-selected.
    const pressed = within(sheet).queryAllByRole('button').filter((button) => button.getAttribute('aria-pressed') === 'true');
    expect(pressed).toEqual([]);
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
  });

  it('saves the picked version for the chosen number of copies', async () => {
    const user = userEvent.setup();
    render(<CardVersionsSheet card={snatch()} open onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Mudar versão' }));
    await user.click(screen.getByRole('button', { name: /Welcome to Rathe/ }));
    await user.click(screen.getByRole('button', { name: 'Unlimited' }));
    await user.click(screen.getByRole('button', { name: 'Sem foil' }));
    await user.click(screen.getByRole('button', { name: 'LP' }));
    await user.click(screen.getByRole('button', { name: 'só 1' }));
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(moveMutate).toHaveBeenCalledTimes(1);
    expect(moveMutate.mock.calls[0]![0]).toEqual({
      cardIdentifier: 'snatch-red',
      from: NO_VERSION,
      to: { printingCode: 'WTR167', edition: 'unlimited', finish: 'none', condition: 'LP' },
      quantity: 1,
    });
  });

  it('a picked printing narrows the editions and finishes to its own', async () => {
    const user = userEvent.setup();
    render(<CardVersionsSheet card={snatch()} open onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Mudar versão' }));
    await user.click(screen.getByRole('button', { name: /History Pack 1/ }));

    expect(screen.queryByRole('button', { name: 'Alpha' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rainbow Foil' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sem foil' })).toBeInTheDocument();
  });

  it('the search field lists the printings that match', async () => {
    const user = userEvent.setup();
    render(<CardVersionsSheet card={snatch()} open onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Mudar versão' }));
    await user.type(screen.getByPlaceholderText('Procurar versão'), 'promos');

    expect(screen.getByRole('button', { name: /ANQ031/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /FAB331/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /WTR167/ })).not.toBeInTheDocument();
  });
});
