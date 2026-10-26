import { catalog } from '@rathe-arsenal/engine';
import { validateDeckProposal, validateSwapProposal } from '../proposal-validation';

const KATSU = 'katsu-the-wanderer';
const CC = 'Classic Constructed';

function deck(cards: Array<{ cardIdentifier: string; quantity: number; slot: string }>, overrides: Record<string, unknown> = {}) {
  return { name: 'Katsu tempo', heroIdentifier: KATSU, format: CC, cards, reason: 'fast', ...overrides };
}

function findBy(predicate: (card: (typeof catalog.cards)[number]) => boolean): string {
  const found = catalog.cards.find(predicate);
  if (!found) throw new Error('fixture card missing');
  return found.cardIdentifier;
}

describe('proposal validation', () => {
  const katsu = catalog.getCard(KATSU);
  const legal = (id: string) => {
    const result = validateDeckProposal(deck([{ cardIdentifier: id, quantity: 1, slot: 'mainboard' }]), catalog);
    return result.ok;
  };
  const otherClass = findBy((card) => card.classes.length > 0 && !card.classes.some((c) => katsu.classes.includes(c)) && card.types.includes('Action' as never) && !legal(card.cardIdentifier));
  const equipment = findBy((card) => card.types.includes('Equipment' as never) && card.classes.includes('Generic' as never));
  const weapon = findBy((card) => card.types.includes('Weapon' as never) && card.classes.some((c) => katsu.classes.includes(c)));

  it('validates a deck proposal against the catalog', () => {
    const code = (args: Record<string, unknown>) => {
      const result = validateDeckProposal(args, catalog);
      return result.ok ? 'ok' : result.error;
    };

    expect(code(deck([{ cardIdentifier: 'flex-red', quantity: 3, slot: 'mainboard' }, { cardIdentifier: 'emissary-of-tides-red', quantity: 2, slot: 'mainboard' }]))).toBe('ok');
    expect(code(deck([], { heroIdentifier: 'flex-red' }))).toBe('HERO_INVALID');
    expect(code(deck([{ cardIdentifier: 'not-a-card', quantity: 1, slot: 'mainboard' }]))).toBe('CARD_UNKNOWN');
    expect(code(deck([{ cardIdentifier: otherClass, quantity: 1, slot: 'mainboard' }]))).toBe('CARD_ILLEGAL');
    expect(code(deck([{ cardIdentifier: equipment, quantity: 1, slot: 'mainboard' }]))).toBe('SLOT_MISMATCH');
    expect(code(deck([{ cardIdentifier: weapon, quantity: 1, slot: 'equipment' }]))).toBe('SLOT_MISMATCH');
    expect(code(deck([{ cardIdentifier: 'flex-red', quantity: 3, slot: 'mainboard' }, { cardIdentifier: 'flex-red', quantity: 1, slot: 'mainboard' }]))).toBe('COPY_LIMIT');
    expect(code(deck([], { name: '' }))).toBe('INVALID_ARGUMENTS');
    expect(code(deck([], { name: 'n'.repeat(121) }))).toBe('INVALID_ARGUMENTS');
    expect(code(deck(Array.from({ length: 81 }, () => ({ cardIdentifier: 'flex-red', quantity: 1, slot: 'mainboard' }))))).toBe('INVALID_ARGUMENTS');
  });

  it('validates a swap with the adoption rules', () => {
    const katsuDeck = {
      heroIdentifier: KATSU,
      format: CC,
      cards: [
        { cardIdentifier: 'emissary-of-tides-red', slot: 'mainboard', quantity: 2 },
        { cardIdentifier: 'flex-red', slot: 'mainboard', quantity: 2 },
        { cardIdentifier: 'talishar-the-lost-prince', slot: 'weapon', quantity: 1 },
      ],
    };
    const ninjaCard = findBy(
      (card) => card.classes.includes('Ninja' as never) && card.types.includes('Action' as never) && card.cardIdentifier !== 'emissary-of-tides-red' && legal(card.cardIdentifier),
    );
    const swap = (overrides: Record<string, unknown>) => ({
      trackedDeckId: 1,
      originalCardIdentifier: 'flex-red',
      slot: 'mainboard',
      replacementCardIdentifier: ninjaCard,
      reason: 'better',
      ...overrides,
    });
    const code = (args: Record<string, unknown>, target: typeof katsuDeck | null = katsuDeck) => {
      const result = validateSwapProposal(args as never, target, catalog);
      return result.ok ? 'ok' : result.error;
    };

    expect(code(swap({}))).toBe('ok');
    expect(code(swap({ originalCardIdentifier: 'coax-a-commotion-red' }))).toBe('NOTHING_TO_REPLACE');
    expect(code(swap({ originalCardIdentifier: 'talishar-the-lost-prince', slot: 'weapon' }))).toBe('REPLACEMENT_ILLEGAL');
    expect(code(swap({}), null)).toBe('DECK_NOT_FOUND');
    expect(validateSwapProposal(swap({}) as never, katsuDeck, catalog)).toEqual(expect.objectContaining({ ok: true, copies: 2 }));
  });

  it("a swap's quantity and side are checked against the deck and the limits", () => {
    const pack = (pitch: string) => `pack-hunt-${pitch}`;
    const rhinarDeck = {
      heroIdentifier: 'rhinar-reckless-rampage',
      format: CC,
      cards: [
        { cardIdentifier: pack('red'), slot: 'mainboard', quantity: 3, inventoryQuantity: 1 },
        { cardIdentifier: pack('yellow'), slot: 'mainboard', quantity: 3 },
      ],
    };
    const woundingBlow = findBy((card) => card.name === 'Wounding Blow' && card.pitch === 1);
    const swap = (overrides: Record<string, unknown>) => ({
      trackedDeckId: 1,
      originalCardIdentifier: pack('red'),
      slot: 'mainboard',
      replacementCardIdentifier: woundingBlow,
      reason: 'a legal card the user lacks',
      ...overrides,
    });
    const answer = (args: Record<string, unknown>, target: typeof rhinarDeck | null = rhinarDeck) => {
      const result = validateSwapProposal(args as never, target, catalog);
      return result.ok ? 'ok' : `${result.ok}:${result.error}`;
    };

    expect(answer(swap({ quantity: 1, side: 'deck' }))).toBe('ok');
    expect(answer(swap({ quantity: 1, side: 'inventory' }))).toBe('ok');
    expect(answer(swap({ quantity: 0, side: 'deck' }))).toBe('false:INVALID_ARGUMENTS');
    expect(answer(swap({ quantity: 2, side: 'inventory' }))).toBe('false:REPLACEMENT_ILLEGAL');
    expect(answer(swap({ quantity: 1, side: 'bench' }))).toBe('false:INVALID_ARGUMENTS');
    expect(answer(swap({ quantity: 1, side: 'inventory', replacementCardIdentifier: pack('yellow'), originalCardIdentifier: pack('red') }))).toBe('false:REPLACEMENT_ILLEGAL');
    const stored = validateSwapProposal(swap({ quantity: 1, side: 'inventory' }) as never, rhinarDeck, catalog);
    expect(stored).toEqual(expect.objectContaining({ ok: true, copies: 1, payload: expect.objectContaining({ quantity: 1, side: 'inventory' }) }));
  });
});
