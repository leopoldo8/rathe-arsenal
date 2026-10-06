import { catalog, Type } from '@rathe-arsenal/engine';
import {
  buildRecommendationPool,
  buildRecommendationPrompt,
  computeDeckFingerprint,
  IDeckList,
  RECOMMENDATION_ASK_COUNT,
} from '../recommendation-prompt';

const KATSU = catalog.getCard('katsu-the-wanderer');

const deck: IDeckList = {
  heroIdentifier: 'katsu-the-wanderer',
  format: 'Classic Constructed',
  cards: [
    { cardIdentifier: 'katsu-the-wanderer', slot: 'hero', quantity: 1 },
    { cardIdentifier: 'emissary-of-tides-red', slot: 'mainboard', quantity: 2 },
    { cardIdentifier: 'flex-red', slot: 'mainboard', quantity: 2 },
    { cardIdentifier: 'talishar-the-lost-prince', slot: 'weapon', quantity: 1 },
  ],
};

describe('recommendation pool and prompt', () => {
  it('the pool keeps legal cards and drops each excluded kind', () => {
    const pool = buildRecommendationPool(deck, KATSU, new Set(['adrenaline-rush-blue']), catalog);
    const ids = new Set(pool.map((card) => card.cardIdentifier));

    expect(ids.has('ancestral-harmony-blue')).toBe(true);
    expect(ids.has('adrenaline-rush-red')).toBe(true);
    expect(ids.has('arcane-lantern')).toBe(true);

    expect(ids.has('art-of-war-yellow')).toBe(false);
    expect(ids.has('a-bit-off-the-side-red')).toBe(false);
    expect(ids.has('katsu-the-wanderer')).toBe(false);
    expect(pool.some((card) => card.types.includes(Type.Hero))).toBe(false);
    expect(ids.has('agility')).toBe(false);
    expect(pool.some((card) => card.types.includes(Type.Token))).toBe(false);
    expect(ids.has('edge-of-autumn')).toBe(false);
    expect(pool.some((card) => card.types.includes(Type.Weapon))).toBe(false);
    expect(ids.has('emissary-of-tides-red')).toBe(false);
    expect(ids.has('flex-red')).toBe(false);
    expect(ids.has('adrenaline-rush-blue')).toBe(false);
  });

  it('the prompt lists the deck by slot and asks for 25 cards', () => {
    const pool = buildRecommendationPool(deck, KATSU, new Set(), catalog).slice(0, 3);

    const { system, prompt } = buildRecommendationPrompt(deck, KATSU, pool, catalog);

    expect(prompt).toContain('Hero: Katsu, the Wanderer');
    expect(prompt).toContain('Format: Classic Constructed');
    expect(prompt).toMatch(/^2x \[mainboard\] emissary-of-tides-red \| /m);
    expect(prompt).toMatch(/^2x \[mainboard\] flex-red \| /m);
    expect(prompt).toMatch(/^1x \[weapon\] talishar-the-lost-prince \| /m);
    expect(prompt).not.toMatch(/^1x \[hero\]/m);
    for (const card of pool) {
      expect(prompt).toContain(`${card.cardIdentifier} | ${card.name} | `);
      expect(prompt).toContain(card.functionalText ?? '');
    }
    expect(prompt).toContain(`Rank the ${RECOMMENDATION_ASK_COUNT} cards`);
    expect(RECOMMENDATION_ASK_COUNT).toBe(25);
    expect(prompt).toMatch(/strength \(clear_upgrade or consider\)/);
    expect(prompt).toMatch(/cut \(the identifier of the deck card it should replace, or an empty string\)/);
    expect(prompt).toMatch(/one sentence of reason/);
    expect(system).toContain('clear_upgrade');
  });

  it('the fingerprint ignores order and tracks every input', () => {
    const base = computeDeckFingerprint(deck);

    expect(base).toMatch(/^[0-9a-f]{64}$/);
    expect(computeDeckFingerprint({ ...deck, cards: [...deck.cards].reverse() })).toBe(base);
    expect(
      computeDeckFingerprint({
        ...deck,
        cards: [
          ...deck.cards.filter((card) => card.cardIdentifier !== 'flex-red'),
          { cardIdentifier: 'flex-red', slot: 'mainboard', quantity: 1 },
          { cardIdentifier: 'flex-red', slot: 'mainboard', quantity: 1 },
        ],
      }),
    ).toBe(base);

    const changed = [
      { ...deck, cards: deck.cards.map((card) => (card.cardIdentifier === 'flex-red' ? { ...card, quantity: 3 } : card)) },
      { ...deck, heroIdentifier: 'katsu' },
      { ...deck, format: 'Blitz' },
      { ...deck, cards: deck.cards.map((card) => (card.cardIdentifier === 'flex-red' ? { ...card, slot: 'equipment' } : card)) },
    ];
    for (const variant of changed) expect(computeDeckFingerprint(variant)).not.toBe(base);
  });
});
