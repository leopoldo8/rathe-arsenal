import { computeSpare, countSpareByRule, decksShareACard, ISpareDeck, ISpareOwnedCopy } from '../spare-copies';

const PACK_HUNT = 'pack-hunt-blue';

function deck(id: number, name: string, format: string, status: ISpareDeck['status'], quantity: number, inventoryQuantity = 0): ISpareDeck {
  return { id, name, format, status, lines: [{ cardIdentifier: PACK_HUNT, quantity, inventoryQuantity }] };
}

function owned(quantity: number, finish: ISpareOwnedCopy['finish'] = '', cardIdentifier = PACK_HUNT): ISpareOwnedCopy {
  return { cardIdentifier, printingCode: '', edition: '', finish, condition: '', quantity };
}

/** The shared scenario of the spare checks: 6 copies, Kayo CC 3, Rhinar CC 2, Rhinar SA 2, Dash ideia 3. */
function sharedScenario(): { copies: ISpareOwnedCopy[]; decks: ISpareDeck[] } {
  return {
    copies: [owned(6)],
    decks: [
      deck(1, 'Kayo CC', 'Classic Constructed', 'building', 3),
      deck(2, 'Rhinar CC', 'Classic Constructed', 'ready', 2),
      deck(3, 'Rhinar SA', 'Silver Age', 'active', 2),
      deck(4, 'Dash ideia', 'Classic Constructed', 'idea', 3),
    ],
  };
}

const spareOf = (copies: ISpareOwnedCopy[], decks: ISpareDeck[], rule: 'within_format' | 'any_deck' | 'per_deck'): number =>
  computeSpare({ copies, decks, rule }).cards.get(PACK_HUNT)?.spare ?? 0;

describe('spare copies', () => {
  it('held copies follow each of the three rules', () => {
    const { copies, decks } = sharedScenario();

    expect(spareOf(copies, decks, 'within_format')).toBe(1);
    expect(spareOf(copies, decks, 'any_deck')).toBe(3);
    // 7 held against 6 owned never goes below 0.
    expect(spareOf(copies, decks, 'per_deck')).toBe(0);
    expect(computeSpare({ copies, decks, rule: 'per_deck' }).cards.get(PACK_HUNT)?.held).toBe(7);
    expect(computeSpare({ copies, decks, rule: 'within_format' }).cards.get(PACK_HUNT)?.held).toBe(5);
  });

  it('only building, ready and active decks hold copies', () => {
    const { copies, decks } = sharedScenario();
    const withRetired = [...decks, deck(5, 'Velho', 'Classic Constructed', 'retired', 4)];

    for (const rule of ['within_format', 'any_deck', 'per_deck'] as const) {
      expect(spareOf(copies, withRetired, rule)).toBe(spareOf(copies, decks, rule));
    }

    const ideaToBuilding = decks.map((entry) => (entry.id === 4 ? { ...entry, status: 'building' as const } : entry));
    expect(spareOf(copies, ideaToBuilding, 'any_deck')).toBe(3);
    expect(spareOf(copies, ideaToBuilding, 'within_format')).toBe(1);

    const holding: Record<ISpareDeck['status'], number> = { idea: 6, building: 3, ready: 3, active: 3, retired: 6 };
    for (const [status, expected] of Object.entries(holding) as Array<[ISpareDeck['status'], number]>) {
      expect(spareOf([owned(6)], [deck(1, 'Um', 'Classic Constructed', status, 3)], 'per_deck')).toBe(expected);
    }
  });

  it('a deck holds its inventory copies too', () => {
    const rhinar = deck(2, 'Rhinar CC', 'Classic Constructed', 'ready', 2, 1);

    const result = computeSpare({ copies: [owned(6)], decks: [rhinar], rule: 'per_deck' }).cards.get(PACK_HUNT);

    expect(result?.held).toBe(3);
    expect(result?.spare).toBe(3);
    expect(result?.holders).toEqual([
      { deckId: 2, deckName: 'Rhinar CC', format: 'Classic Constructed', deck: 2, inventory: 1, use: 3 },
    ]);
  });

  it('a deck holds the foil copies first, Cold before Rainbow', () => {
    const copies = [owned(1, 'cold'), owned(1, 'rainbow'), owned(2, 'none')];

    const usingTwo = computeSpare({
      copies,
      decks: [deck(1, 'Kayo CC', 'Classic Constructed', 'building', 2)],
      rule: 'per_deck',
    }).rows;
    const usingOne = computeSpare({
      copies,
      decks: [deck(1, 'Kayo CC', 'Classic Constructed', 'building', 1)],
      rule: 'per_deck',
    }).rows;

    expect(usingTwo.map((row) => [row.finish, row.spare])).toEqual([['none', 2]]);
    expect(usingOne.map((row) => [row.finish, row.spare])).toEqual([
      ['rainbow', 1],
      ['none', 2],
    ]);
  });

  it('keeps Gold after Rainbow and the unknown finish last', () => {
    const copies = [owned(1, ''), owned(1, 'none'), owned(1, 'gold'), owned(1, 'rainbow'), owned(1, 'cold')];

    const rows = computeSpare({ copies, decks: [deck(1, 'Kayo CC', 'Classic Constructed', 'building', 3)], rule: 'per_deck' }).rows;

    expect(rows.map((row) => row.finish).sort()).toEqual(['', 'none']);
  });

  it('asks for the rule only when two holding decks share a card', () => {
    const { decks } = sharedScenario();
    const two = decks.slice(0, 2);

    expect(decksShareACard(two)).toBe(true);
    expect(decksShareACard([two[0]!])).toBe(false);
    // The Ideia deck holds nothing, so sharing with it asks nothing.
    expect(decksShareACard([two[0]!, decks[3]!])).toBe(false);
    expect(decksShareACard([two[0]!, { ...two[1]!, lines: [{ cardIdentifier: 'other', quantity: 1, inventoryQuantity: 0 }] }])).toBe(false);
  });

  it('counts the spare copies of every rule together', () => {
    const { copies, decks } = sharedScenario();

    expect(countSpareByRule(copies, decks)).toEqual({ within_format: 1, any_deck: 3, per_deck: 0 });
  });

  it('a card no deck uses is all spare and keeps its rows by version', () => {
    const rows = computeSpare({ copies: [owned(2, 'none'), owned(1, '')], decks: [], rule: 'per_deck' }).rows;

    expect(rows.map((row) => [row.cardIdentifier, row.finish, row.spare])).toEqual([
      [PACK_HUNT, 'none', 2],
      [PACK_HUNT, '', 1],
    ]);
  });

  it('names the decks that use a card without holding it', () => {
    const { copies, decks } = sharedScenario();

    const result = computeSpare({ copies, decks: [...decks, deck(5, 'Velho', 'Classic Constructed', 'retired', 4)], rule: 'within_format' }).cards.get(PACK_HUNT);

    expect(result?.notHolding.map((entry) => [entry.deckName, entry.status])).toEqual([
      ['Dash ideia', 'idea'],
      ['Velho', 'retired'],
    ]);
  });
});
