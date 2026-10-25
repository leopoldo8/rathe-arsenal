import { catalog } from '@rathe-arsenal/engine';
import { compareSwap, swapCandidates } from '../swap-analysis';

const MAINBOARD = [
  'boltn-shot-red',
  'call-in-the-big-guns-red',
  'drill-shot-red',
  'dry-powder-shot-red',
  'infecting-shot-blue',
  'infecting-shot-red',
  'infecting-shot-yellow',
  'lace-with-bloodrot-red',
  'lace-with-frailty-red',
  'lace-with-inertia-red',
  'murkmire-grapnel-red',
  'ravenous-rabble-red',
  'read-the-glide-path-red',
  'release-the-tension-red',
  'ridge-rider-shot-red',
  'scout-the-periphery-red',
  'searing-shot-red',
  'spire-sniping-yellow',
  'swift-shot-red',
  'take-aim-red',
];

const AZALEA_DECK = [
  { cardIdentifier: 'azalea', slot: 'hero', quantity: 1 },
  { cardIdentifier: 'death-dealer', slot: 'weapon', quantity: 1 },
  ...['blade-beckoner-plating', 'boltn-boots', 'bulls-eye-bracers', 'crows-nest', 'talismanic-lens'].map((cardIdentifier) => ({
    cardIdentifier,
    slot: 'equipment',
    quantity: 1,
  })),
  ...MAINBOARD.map((cardIdentifier) => ({ cardIdentifier, slot: 'mainboard', quantity: 2 })),
];

const card = (cardIdentifier: string) => catalog.getCard(cardIdentifier);

describe('compareSwap', () => {
  it('flags a swap that changes the role, and gives the cost, pitch and stat changes with the cost curve before and after', () => {
    const comparison = compareSwap({
      original: card('lace-with-bloodrot-red'),
      replacement: card('widowmaker-yellow'),
      slot: 'mainboard',
      quantity: 2,
      deckCards: AZALEA_DECK,
    });

    expect(comparison).toEqual({
      copies: 2,
      original: { name: 'Lace with Bloodrot', typeLine: 'Ranger Action Non-Attack', cost: 0, pitch: 1, power: null, defense: 2 },
      replacement: { name: 'Widowmaker', typeLine: 'Ranger Action Arrow Attack', cost: 1, pitch: 2, power: 3, defense: 3 },
      sameRole: false,
      unmetRequirement: null,
      costDelta: 1,
      pitchDelta: 1,
      powerDelta: null,
      defenseDelta: 1,
      mainboardByCostBefore: { '0': 32, '1': 8 },
      mainboardByCostAfter: { '0': 30, '1': 10 },
    });
  });

  it('keeps the role for a card of the same types and subtypes, even when it costs more', () => {
    const comparison = compareSwap({
      original: card('lace-with-bloodrot-red'),
      replacement: card('fletch-a-red-tail-red'),
      slot: 'mainboard',
      quantity: 2,
      deckCards: AZALEA_DECK,
    });

    expect([comparison.sameRole, comparison.costDelta, comparison.pitchDelta]).toEqual([true, 1, 0]);
    expect(comparison.mainboardByCostAfter).toEqual({ '0': 30, '1': 10 });
  });

  it('leaves the mainboard curve alone for an equipment swap and gives no cost change for cards without a cost', () => {
    const comparison = compareSwap({
      original: card('boltn-boots'),
      replacement: card('quick-clicks'),
      slot: 'equipment',
      quantity: 1,
      deckCards: AZALEA_DECK,
    });

    expect([comparison.sameRole, comparison.costDelta, comparison.defenseDelta]).toEqual([true, null, -1]);
    expect(comparison.mainboardByCostAfter).toEqual(comparison.mainboardByCostBefore);
  });

  it('names a card the replacement needs played that turn when the deck has none, and stays quiet when it has one', () => {
    const swap = (deckCards: typeof AZALEA_DECK) =>
      compareSwap({ original: card('boltn-boots'), replacement: card('quick-clicks'), slot: 'equipment', quantity: 1, deckCards });

    expect(swap(AZALEA_DECK).unmetRequirement).toBe('Nimblism');
    expect(swap([...AZALEA_DECK, { cardIdentifier: 'nimblism-red', slot: 'mainboard', quantity: 2 }]).unmetRequirement).toBeNull();
    expect(
      compareSwap({ original: card('lace-with-bloodrot-red'), replacement: card('toxicity-red'), slot: 'mainboard', quantity: 2, deckCards: AZALEA_DECK })
        .unmetRequirement,
    ).toBeNull();
  });

  it('reads a requirement for a kind of card against the kinds the deck plays', () => {
    const lightning = card('photon-rush-red');
    const deck = (cardIdentifier: string) => [{ cardIdentifier, slot: 'mainboard', quantity: 2 }];
    const swap = (deckCards: ReturnType<typeof deck>) =>
      compareSwap({ original: card(deckCards[0]!.cardIdentifier), replacement: lightning, slot: 'mainboard', quantity: 1, deckCards });

    expect(swap(deck('flex-red')).unmetRequirement).toBe('Lightning card');
    expect(swap(deck('lightning-press-red')).unmetRequirement).toBeNull();
  });

  it('moves only the copies the swap moves', () => {
    const comparison = compareSwap({
      original: card('lace-with-bloodrot-red'),
      replacement: card('fletch-a-red-tail-red'),
      slot: 'mainboard',
      quantity: 1,
      deckCards: AZALEA_DECK,
    });

    expect(comparison.mainboardByCostAfter).toEqual({ '0': 31, '1': 9 });
  });
});

describe('swapCandidates', () => {
  const candidates = swapCandidates({
    original: card('lace-with-bloodrot-red'),
    slot: 'mainboard',
    heroCard: card('azalea'),
    format: 'Silver Age',
    deckCards: AZALEA_DECK,
    spare: new Map([
      ['toxicity-red', 1],
      ['widowmaker-yellow', 2],
    ]),
  });
  const all = candidates.groups.flatMap((group) => group.cards);

  it("lists the app's ranked alternatives, closest group first, with cost, role and stat changes", () => {
    expect(candidates.copies).toBe(2);
    expect(candidates.groups[0]!.group).toBe('very_close');
    const veryClose = candidates.groups[0]!.cards.map((entry) => entry.cardIdentifier);
    expect(veryClose).toEqual(expect.arrayContaining(['toxicity-red', 'fire-in-the-hole-red']));
    expect(all.find((entry) => entry.cardIdentifier === 'fire-in-the-hole-red')).toEqual({
      cardIdentifier: 'fire-in-the-hole-red',
      name: 'Fire in the Hole',
      typeLine: expect.stringContaining('Non-Attack'),
      cost: 0,
      costDelta: 0,
      pitch: 1,
      power: null,
      defense: 2,
      sameRole: true,
      unmetRequirement: null,
      freeCopies: 0,
      text: expect.stringContaining('arrow'),
    });
  });

  it('counts free copies from the spare collection and leaves out cards the role does not fit or the deck already holds at the limit', () => {
    expect(all.find((entry) => entry.cardIdentifier === 'toxicity-red')?.freeCopies).toBe(1);
    expect(all.map((entry) => entry.cardIdentifier)).not.toContain('widowmaker-yellow');
    expect(all.map((entry) => entry.cardIdentifier)).not.toContain('lace-with-frailty-red');
    expect(all.map((entry) => entry.cardIdentifier)).not.toContain('lace-with-bloodrot-red');
  });

  it('caps each group', () => {
    expect(candidates.groups.every((group) => group.cards.length <= 6)).toBe(true);
  });
});

describe('swapCandidates needed', () => {
  const rhinar = card('rhinar-reckless-rampage');
  const deckWith = (quantity: number, inventoryQuantity = 0) => [
    { cardIdentifier: 'rhinar-reckless-rampage', slot: 'hero', quantity: 1 },
    { cardIdentifier: 'pack-hunt-red', slot: 'mainboard', quantity, inventoryQuantity },
  ];
  const ask = (deckCards: ReturnType<typeof deckWith>, quantity?: number) =>
    swapCandidates({
      original: card('pack-hunt-red'),
      slot: 'mainboard',
      heroCard: rhinar,
      format: 'Classic Constructed',
      deckCards,
      spare: new Map(),
      ...(quantity === undefined ? {} : { quantity }),
    });

  it('needed follows the quantity given, else the copies over the limit, else every copy', () => {
    expect(ask(deckWith(3), 1).needed).toBe(1);
    expect(ask(deckWith(4)).needed).toBe(1);
    expect(ask(deckWith(3, 1)).needed).toBe(1);
    expect(ask(deckWith(3)).needed).toBe(3);
    expect(ask(deckWith(2)).needed).toBe(2);
    expect(ask(deckWith(2), 5).needed).toBe(2);
  });

  it('finds candidates for a card over its limit, where every copy together left none', () => {
    const over = ask(deckWith(4));

    expect(over.copies).toBe(4);
    expect(over.groups.length).toBeGreaterThan(0);
    expect(over.groups.flatMap((group) => group.cards).length).toBeGreaterThan(0);
  });
});
