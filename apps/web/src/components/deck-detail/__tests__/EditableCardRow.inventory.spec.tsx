/**
 * The inventory in the deck editor and on the deck page (door 3): two steppers per card, the header
 * with the pool, the row that says what to take out across both sides, the menu that moves copies,
 * and the missing line that splits deck from inventory. Screens: `r3-inventory-desktop`.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeckCanvas } from '../DeckCanvas';
import { DeckStatusStrip } from '../DeckStatusStrip';
import { summariseDeck } from '../deckDetailModel';
import { cascadeFromLegality, computeDraftLegality } from '../../../lib/draft-legality';
import { useCompositionDraft, type ICompositionDraftInitialPayload } from '../../../hooks/useCompositionDraft';
import type { IHeroListItem } from '../../../api/catalog';
import type { IBreakdown, IBreakdownEntry } from '../../../api/deck-detail';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/home">{children}</a>,
  useNavigate: () => vi.fn(),
  useRouter: () => ({ history: { back: vi.fn() } }),
}));
vi.mock('../../card-art/CardArt', () => ({
  CardArt: ({ name }: { name: string }) => <div>{name}</div>,
}));
vi.mock('../../card-art/CardLightbox', () => ({ CardLightbox: () => null }));
vi.mock('../../../api/replacements', () => ({
  useUseSuggestions: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('../../deck-card-search/DeckCardSearchAutocomplete', () => ({ DeckCardSearchAutocomplete: () => null }));
vi.mock('../HeroDropdown', () => ({ HeroDropdown: () => null }));
vi.mock('../../../assets/icons/slot-mainboard.svg?react', () => ({ default: () => null }));
vi.mock('../../../assets/icons/slot-hero.svg?react', () => ({ default: () => null }));
vi.mock('../../../assets/icons/slot-weapon.svg?react', () => ({ default: () => null }));
vi.mock('../../../assets/icons/slot-equipment.svg?react', () => ({ default: () => null }));

const KATSU: IHeroListItem = {
  cardIdentifier: 'katsu-the-wanderer',
  name: 'Katsu',
  hero: 'Katsu',
  young: false,
  legalFormats: ['Classic Constructed', 'Living Legend'],
  imageUrl: null,
};

type TPayloadCard = ICompositionDraftInitialPayload['cards'][number];

function card(cardIdentifier: string, name: string, pitch: number, quantity: number, inventoryQuantity = 0): TPayloadCard {
  return {
    cardIdentifier,
    name,
    quantity,
    inventoryQuantity,
    slot: 'mainboard',
    pitch,
    cost: 2,
    type: 'Action',
    imageUrl: null,
    legalFormats: ['Classic Constructed'],
    legalHeroes: [],
    bannedFormats: [],
  };
}

function loadout(cardIdentifier: string, name: string, slot: 'weapon' | 'equipment'): TPayloadCard {
  return {
    cardIdentifier,
    name,
    quantity: 1,
    slot,
    pitch: null,
    cost: null,
    type: slot === 'weapon' ? 'Weapon' : 'Equipment',
    imageUrl: null,
    legalFormats: ['Classic Constructed'],
    legalHeroes: [],
    bannedFormats: [],
  };
}

function Editor({ cards }: { cards: ICompositionDraftInitialPayload['cards'] }): React.ReactElement {
  const payload = React.useMemo(
    () => ({ cards, heroIdentifier: 'katsu-the-wanderer', format: 'Classic Constructed' }),
    [cards],
  );
  const composition = useCompositionDraft(7, payload);
  const legality = React.useMemo(() => computeDraftLegality(composition.draft, KATSU), [composition.draft]);
  return (
    <DeckCanvas
      compositionDraft={composition.draft}
      cascadeCheck={cascadeFromLegality(legality)}
      legality={legality}
      heroName="Katsu"
      onUpdateQuantity={composition.updateQuantity}
      onUpdateInventoryQuantity={composition.updateInventoryQuantity}
      onMoveCopies={composition.moveCopies}
      onRemoveCard={composition.removeCard}
    />
  );
}

function stepperValue(row: HTMLElement, side: 'deck' | 'inventory'): string {
  const group = within(row).getByTestId(`stepper-${side}`);
  return within(group).getByTestId(`quantity-${side}`).textContent ?? '';
}

describe('the inventory in the deck editor', () => {
  it('matches r3-inventory-desktop', () => {
    // 20 cards at 3 copies are the deck (60), 5 cards at 3 copies the inventory (15), one weapon and
    // four equipment the rest of the pool: 80 of 80.
    const deck = Array.from({ length: 20 }, (_, index) => card(`deck-card-${index}`, `Deck Card ${index}`, 1, 3));
    const inventory = Array.from({ length: 5 }, (_, index) => card(`spare-card-${index}`, `Spare Card ${index}`, 3, 0, 3));
    const gear = [
      loadout('anothos', 'Anothos', 'weapon'),
      loadout('a', 'Gear A', 'equipment'),
      loadout('b', 'Gear B', 'equipment'),
      loadout('c', 'Gear C', 'equipment'),
      loadout('d', 'Gear D', 'equipment'),
    ];
    const { container } = render(<Editor cards={[...deck, ...inventory, ...gear]} />);

    const text = container.textContent ?? '';
    const inOrder = [
      'Deck 60 · Inventário 15 · Card pool 80 de 80',
      'Inventário: cartas que você leva ao torneio além do deck. Entre um jogo e outro da mesma partida, dá para trocar cartas do deck por elas.',
      'Cartas que você leva: 80 de 80',
      'o deck, o inventário, a arma e os equipamentos; o herói não conta. No torneio isto se chama card pool.',
      'Carta',
      'No deck',
      'No inventário',
    ];
    let cursor = -1;
    for (const part of inOrder) {
      const at = text.indexOf(part, cursor + 1);
      expect(at, part).toBeGreaterThan(cursor);
      cursor = at;
    }
    expect(text.split('Inventário: cartas que você leva').length - 1, 'the inventory line shows once').toBe(1);
    expect(text.split('Cartas que você leva: 80 de 80').length - 1, 'the card pool line shows once').toBe(1);

    const rows = screen.getAllByTestId(/^editable-card-row-/);
    expect(rows).toHaveLength(25);
    for (const row of rows) {
      expect(within(row).getAllByRole('group', { name: /Quantidade/ })).toHaveLength(2);
    }
    const spareRow = screen.getByTestId('editable-card-row-spare-card-0');
    expect(stepperValue(spareRow, 'deck')).toBe('0');
    expect(stepperValue(spareRow, 'inventory')).toBe('3');
  });

  it('shows one stepper and no inventory header for a deck with no inventory copies', () => {
    const cards = [card('pack-hunt-red', 'Pack Hunt', 1, 3), card('snatch-red', 'Snatch', 1, 2)];
    const { container } = render(<Editor cards={cards} />);

    const text = container.textContent ?? '';
    expect(text).not.toContain('Inventário');
    expect(text).not.toContain('Card pool');
    expect(screen.queryByTestId('inventory-summary')).toBeNull();
    for (const row of screen.getAllByTestId(/^editable-card-row-/)) {
      expect(within(row).getAllByRole('group', { name: /Quantidade/ })).toHaveLength(1);
      expect(within(row).queryByTestId('stepper-inventory')).toBeNull();
    }
    expect(screen.queryByText('No inventário')).toBeNull();
  });

  it('shows the second stepper on every row once any card has inventory copies', () => {
    render(<Editor cards={[card('pack-hunt-red', 'Pack Hunt', 1, 3), card('snatch-red', 'Snatch', 1, 0, 2)]} />);

    expect(screen.getByTestId('inventory-summary')).toHaveTextContent('Deck 3 · Inventário 2 · Card pool 5 de');
    for (const row of screen.getAllByTestId(/^editable-card-row-/)) {
      expect(within(row).getAllByRole('group', { name: /Quantidade/ })).toHaveLength(2);
    }
  });

  it('over the limit across deck and inventory', () => {
    render(<Editor cards={[card('pack-hunt-red', 'Pack Hunt', 1, 3, 1)]} />);

    const row = screen.getByTestId('editable-card-row-pack-hunt-red');

    expect(
      within(row).getByText('3 no deck e 1 no inventário, 4 no total. O Classic Constructed permite 3 · tire 1'),
    ).toBeInTheDocument();
    expect(within(row).getByText('Máximo 3 no Classic Constructed, contando o inventário')).toBeInTheDocument();
    expect(screen.getByTestId('increment-pack-hunt-red')).toBeDisabled();
    expect(screen.getByTestId('increment-inventory-pack-hunt-red')).toBeDisabled();
  });

  it('the row menu moves copies between deck and inventory', async () => {
    render(<Editor cards={[card('pack-hunt-red', 'Pack Hunt', 1, 3), card('snatch-red', 'Snatch', 1, 0, 2)]} />);
    const user = userEvent.setup();
    const packHunt = screen.getByTestId('editable-card-row-pack-hunt-red');

    await user.click(within(packHunt).getByTestId('move-from-deck-pack-hunt-red'));
    const toInventory = within(screen.getByRole('menu')).getAllByRole('menuitem').map((item) => item.textContent);
    expect(toInventory).toEqual(['Mover 1 para o inventário', 'Mover todas (3) para o inventário']);

    await user.click(screen.getByRole('menuitem', { name: 'Mover 1 para o inventário' }));
    expect(stepperValue(packHunt, 'deck')).toBe('2');
    expect(stepperValue(packHunt, 'inventory')).toBe('1');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    const snatch = screen.getByTestId('editable-card-row-snatch-red');
    await user.click(within(snatch).getByTestId('move-from-inventory-snatch-red'));
    expect(within(screen.getByRole('menu')).getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Mover 1 para o deck',
      'Mover todas (2) para o deck',
    ]);
    await user.click(screen.getByRole('menuitem', { name: 'Mover todas (2) para o deck' }));
    expect(stepperValue(snatch, 'deck')).toBe('2');
    expect(stepperValue(snatch, 'inventory')).toBe('0');
  });
});

describe('the missing line on the deck page', () => {
  function entry(cardIdentifier: string, quantity: number, inventoryQuantity?: number): IBreakdownEntry {
    return {
      cardIdentifier,
      name: cardIdentifier,
      quantity,
      ...(inventoryQuantity === undefined ? {} : { inventoryQuantity }),
      slot: 'mainboard',
      pitch: 1,
      cost: 2,
      type: 'Action',
      imageUrl: null,
    };
  }

  it('the missing line splits deck and inventory', () => {
    // Four copies missing from the deck and three from the inventory.
    const notOwned = [entry('pack-hunt-red', 4), entry('snatch-red', 3, 3)];
    const breakdown: IBreakdown = { exact: [], substituted: [], missing: notOwned, notOwned };
    const summary = summariseDeck({ pct: 40, breakdown, replacements: [] });

    render(<DeckStatusStrip deckId={7} summary={summary} fabraryUlid={null} />);

    expect(screen.getByTestId('deck-status-strip')).toHaveTextContent(
      'Faltam 7 cópias (4 do deck, 3 do inventário) · Ver o que falta',
    );
  });

  it('keeps the plain count for a deck with no inventory', () => {
    const notOwned = [entry('pack-hunt-red', 4)];
    const summary = summariseDeck({
      pct: 40,
      breakdown: { exact: [], substituted: [], missing: notOwned, notOwned },
      replacements: [],
    });

    render(<DeckStatusStrip deckId={7} summary={summary} fabraryUlid={null} />);

    expect(screen.getByTestId('deck-status-strip-message')).toHaveTextContent('Faltam 4 cartas.');
  });
});
