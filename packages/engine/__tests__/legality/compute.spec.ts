/**
 * Integration tests for computeDeckLegality.
 *
 * Tests use the real catalog singleton to exercise actual FAB card data,
 * matching the test scenarios specified in the U2 plan section.
 *
 * Card data sourced from @flesh-and-blood/cards@^3.6.243.
 *
 * Key hero identifiers:
 *   dorinthea-ironsong      — non-young, legalFormats: ['Classic Constructed', 'Living Legend', 'Open']
 *   kayo-berserker-runt     — young,     legalFormats: ['Blitz', 'Clash', 'Open', 'Silver Age', 'Ultimate Pit Fight']
 *   briar-warden-of-thorns  — non-young, legalFormats: ['Living Legend', 'Open'] (NOT CC)
 *   dorinthea               — young token, legalFormats: does NOT include CC (Blitz/SA etc)
 *
 * Key non-hero card identifiers (verified in @flesh-and-blood/cards@3.6.243):
 *   adrenaline-rush-red     — Common, 80 heroes (Dorinthea+Kayo), CC+Blitz+SA+LL legal
 *   agile-engagement-red    — Common, 7 heroes (incl Dorinthea, NOT Kayo), CC+Blitz+SA+LL legal
 *   aggressive-pounce-red   — Common, legalHeroes: Kayo+Levia+RKO+Rhinar+Tuffnut (NOT Dorinthea)
 *   aether-flare-red        — Common, bannedFormats: ['Silver Age'], CC+Blitz+LL legal
 *   amethyst-amulet-blue    — Majestic, Legendary keyword, legalFormats: CC+Blitz+Draft+LL (NOT SA)
 *   blood-drop-red          — Common, legalHeroes: ['Cindra', 'Fai'] (NOT Dorinthea)
 */

import { computeDeckLegality, computeDeckLegalityInOtherFormats } from '../../src/legality/compute';
import { catalog } from '../../src/catalog/catalog';
import { Keyword, Type } from '../../src/catalog/types';
import { findCardLegalityViolation } from '../../src/legality/card-legality';
import type { ILegalityDeck, IDeckLegalityResult, TLegalityReasonDetail, TSupportedFormat } from '../../src/legality/types';

// ─── Verified card pools ─────────────────────────────────────────────────────

/**
 * 20 valid Dorinthea CC+LL common cards (3 copies each = 60 total).
 * These are all in @flesh-and-blood/cards@3.6.243, CC+LL legal, Common, Dorinthea in legalHeroes.
 */
const DORINTHEA_CC_CARDS_20 = [
  'adrenaline-rush-red',
  'adrenaline-rush-yellow',
  'adrenaline-rush-blue',
  'agile-engagement-red',
  'agile-engagement-yellow',
  'agile-engagement-blue',
  'agile-windup-red',
  'agile-windup-yellow',
  'agile-windup-blue',
  'arcane-polarity-red',
  'arcane-polarity-yellow',
  'arcane-polarity-blue',
  'back-alley-breakline-red',
  'back-alley-breakline-yellow',
  'back-alley-breakline-blue',
  'barraging-brawnhide-red',
  'barraging-brawnhide-yellow',
  'barraging-brawnhide-blue',
  'battlefront-bastion-red',
  'battlefront-bastion-yellow',
];

/**
 * 40 valid Kayo Blitz+SA common cards (1 copy each = 40 total).
 * All are Common, Blitz+SA legal, Kayo in legalHeroes.
 */
const KAYO_BLITZ_CARDS_40 = [
  'adrenaline-rush-red',
  'adrenaline-rush-yellow',
  'adrenaline-rush-blue',
  'aggressive-pounce-red',
  'aggressive-pounce-yellow',
  'aggressive-pounce-blue',
  'agile-windup-red',
  'agile-windup-yellow',
  'agile-windup-blue',
  'arcane-polarity-red',
  'arcane-polarity-yellow',
  'arcane-polarity-blue',
  'assault-and-battery-red',
  'assault-and-battery-yellow',
  'assault-and-battery-blue',
  'awakening-bellow-red',
  'awakening-bellow-yellow',
  'awakening-bellow-blue',
  'back-alley-breakline-red',
  'back-alley-breakline-yellow',
  'back-alley-breakline-blue',
  'bad-beats-red',
  'bad-beats-yellow',
  'bad-beats-blue',
  'bare-fangs-red',
  'bare-fangs-yellow',
  'bare-fangs-blue',
  'bark-obscenities-red',
  'barraging-brawnhide-red',
  'barraging-brawnhide-yellow',
  'barraging-brawnhide-blue',
  'bash-guardian-red',
  'battlefront-bastion-red',
  'battlefront-bastion-yellow',
  'battlefront-bastion-blue',
  'bear-hug-red',
  'bear-hug-yellow',
  'bear-hug-blue',
  'bonebreaker-bellow-red',
  'bonebreaker-bellow-yellow',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a minimal ILegalityDeck with a hero + N mainboard card entries. */
function makeDeck(
  heroIdentifier: string | null,
  mainboardCards: Array<{ cardIdentifier: string; quantity: number }>,
): ILegalityDeck {
  const cards: ILegalityDeck['cards'] = [
    ...(heroIdentifier != null
      ? [{ cardIdentifier: heroIdentifier, quantity: 1, slot: 'hero' }]
      : []),
    ...mainboardCards.map((c) => ({ ...c, slot: 'mainboard' })),
  ];
  return Object.freeze({ heroIdentifier, cards: Object.freeze(cards) });
}

/** Build 60 CC mainboard cards (3 copies of each of 20 cards). */
function buildCC60(): Array<{ cardIdentifier: string; quantity: number }> {
  return DORINTHEA_CC_CARDS_20.map((id) => ({ cardIdentifier: id, quantity: 3 }));
}

/** Build 40 Blitz/SA singleton mainboard (1 copy of each of 40 cards). */
function buildBlitz40(): Array<{ cardIdentifier: string; quantity: number }> {
  return KAYO_BLITZ_CARDS_40.map((id) => ({ cardIdentifier: id, quantity: 1 }));
}

/** Build N mainboard cards, cycling through the Dorinthea pool with maxCopies copies. */
function buildCCMainboard(totalCards: number, maxCopies = 3): Array<{ cardIdentifier: string; quantity: number }> {
  const slots: Array<{ cardIdentifier: string; quantity: number }> = [];
  let remaining = totalCards;
  let index = 0;
  while (remaining > 0) {
    const qty = Math.min(maxCopies, remaining);
    slots.push({ cardIdentifier: DORINTHEA_CC_CARDS_20[index % DORINTHEA_CC_CARDS_20.length]!, quantity: qty });
    remaining -= qty;
    index++;
  }
  return slots;
}

// ─────────────────────────────────────────────────────────────────────────────
// Happy paths
// ─────────────────────────────────────────────────────────────────────────────

describe('computeDeckLegality — happy paths', () => {
  it('CC happy path: dorinthea-ironsong + 60 mainboard cards → legal', () => {
    const deck = makeDeck('dorinthea-ironsong', buildCC60());
    const result = computeDeckLegality(deck, catalog, 'Classic Constructed');
    expect(result.category).toBe('legal');
    expect(result.reasons).toHaveLength(0);
  });

  it('CC result is frozen', () => {
    const deck = makeDeck('dorinthea-ironsong', buildCC60());
    const result = computeDeckLegality(deck, catalog, 'Classic Constructed');
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.reasons)).toBe(true);
  });

  it('LL happy path: dorinthea-ironsong (LL-legal) + 60 mainboard → legal', () => {
    const deck = makeDeck('dorinthea-ironsong', buildCC60());
    const result = computeDeckLegality(deck, catalog, 'Living Legend');
    expect(result.category).toBe('legal');
  });

  it('format swap: dorinthea-ironsong CC → LL stays legal (multi-format hero)', () => {
    const ccDeck = makeDeck('dorinthea-ironsong', buildCC60());
    const llDeck = makeDeck('dorinthea-ironsong', buildCC60());
    const ccResult = computeDeckLegality(ccDeck, catalog, 'Classic Constructed');
    const llResult = computeDeckLegality(llDeck, catalog, 'Living Legend');
    expect(ccResult.category).toBe('legal');
    expect(llResult.category).toBe('legal');
  });

  it('Blitz singleton: kayo-berserker-runt (young, Blitz-legal) + 40 unique cards → legal', () => {
    const deck = makeDeck('kayo-berserker-runt', buildBlitz40());
    const result = computeDeckLegality(deck, catalog, 'Blitz');
    expect(result.category).toBe('legal');
    expect(result.reasons).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Incomplete paths
// ─────────────────────────────────────────────────────────────────────────────

describe('computeDeckLegality — incomplete (under-minimum)', () => {
  it('CC: 58/60 cards → incomplete with reason mentioning the count', () => {
    const mainboard = buildCCMainboard(58);
    const deck = makeDeck('dorinthea-ironsong', mainboard);
    const result = computeDeckLegality(deck, catalog, 'Classic Constructed');
    expect(result.category).toBe('incomplete');
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(result.reasons[0]).toMatch(/58/);
    expect(result.reasons[0]).toMatch(/60/);
  });

  it('CC: empty deck (hero only, 0 mainboard) → incomplete (not illegal)', () => {
    // Hero passes step 1; 0 mainboard fails step 3 incomplete branch.
    const deck = makeDeck('dorinthea-ironsong', []);
    const result = computeDeckLegality(deck, catalog, 'Classic Constructed');
    expect(result.category).toBe('incomplete');
    expect(result.reasons[0]).toMatch(/0/);
    expect(result.reasons[0]).toMatch(/60/);
  });

  it('Blitz: 39 cards → incomplete (exact 40 required)', () => {
    const mainboard = buildBlitz40().slice(0, 39);
    const deck = makeDeck('kayo-berserker-runt', mainboard);
    const result = computeDeckLegality(deck, catalog, 'Blitz');
    expect(result.category).toBe('incomplete');
    expect(result.reasons[0]).toMatch(/39/);
    expect(result.reasons[0]).toMatch(/40/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Hero requirement failures (step 1 short-circuits)
// ─────────────────────────────────────────────────────────────────────────────

describe('computeDeckLegality — hero requirement (step 1)', () => {
  it('heroIdentifier=null → illegal with documented reason', () => {
    const deck = makeDeck(null, buildCC60());
    const result = computeDeckLegality(deck, catalog, 'Classic Constructed');
    expect(result.category).toBe('illegal');
    expect(result.reasons[0]).toBe(
      'Hero not recognized — please re-select in Edit mode',
    );
  });

  it('young hero on CC → illegal with hero-requirement reason (short-circuits)', () => {
    // dorinthea (young token) legalFormats does NOT include CC.
    // Step 1 fires: hero not legal in CC. This is the "hero requirement" failure
    // that short-circuits before mainboard or copy-limit checks.
    const mainboard = buildCC60();
    const deck = makeDeck('dorinthea', mainboard);
    const result = computeDeckLegality(deck, catalog, 'Classic Constructed');
    expect(result.category).toBe('illegal');
    expect(result.reasons[0]).toMatch(/Dorinthea/);
    expect(result.reasons[0]).toMatch(/Classic Constructed/);
  });

  it('briar-warden-of-thorns (LL-only) + format CC → illegal (step 1 fail)', () => {
    // legalFormats: ['Living Legend', 'Open'] — NOT CC.
    const deck = makeDeck('briar-warden-of-thorns', buildCC60());
    const result = computeDeckLegality(deck, catalog, 'Classic Constructed');
    expect(result.category).toBe('illegal');
    expect(result.reasons[0]).toMatch(/Briar, Warden of Thorns/);
    expect(result.reasons[0]).toMatch(/Classic Constructed/);
  });

  it('briar-warden-of-thorns + LL format → legal (correct format for this hero)', () => {
    // briar-warden-of-thorns IS LL-legal and non-young → passes step 1.
    // Must use Briar-legal cards (legalHeroes includes Briar):
    // adrenaline-rush-* and arcane-polarity-* are Briar-legal LL commons (verified from catalog).
    const briarLLCards: Array<{ cardIdentifier: string; quantity: number }> = [
      { cardIdentifier: 'adrenaline-rush-red', quantity: 3 },
      { cardIdentifier: 'adrenaline-rush-yellow', quantity: 3 },
      { cardIdentifier: 'adrenaline-rush-blue', quantity: 3 },
      { cardIdentifier: 'arcane-polarity-red', quantity: 3 },
      { cardIdentifier: 'arcane-polarity-yellow', quantity: 3 },
      { cardIdentifier: 'arcane-polarity-blue', quantity: 3 },
      { cardIdentifier: 'back-alley-breakline-red', quantity: 3 },
      { cardIdentifier: 'back-alley-breakline-yellow', quantity: 3 },
      { cardIdentifier: 'back-alley-breakline-blue', quantity: 3 },
      { cardIdentifier: 'barraging-brawnhide-red', quantity: 3 },
      { cardIdentifier: 'barraging-brawnhide-yellow', quantity: 3 },
      { cardIdentifier: 'barraging-brawnhide-blue', quantity: 3 },
      { cardIdentifier: 'battlefront-bastion-red', quantity: 3 },
      { cardIdentifier: 'battlefront-bastion-yellow', quantity: 3 },
      { cardIdentifier: 'battlefront-bastion-blue', quantity: 3 },
      { cardIdentifier: 'aether-slash-red', quantity: 3 },
      { cardIdentifier: 'aether-slash-yellow', quantity: 3 },
      { cardIdentifier: 'aether-slash-blue', quantity: 3 },
      { cardIdentifier: 'arcanic-crackle-red', quantity: 3 },
      { cardIdentifier: 'arcanic-crackle-yellow', quantity: 3 },
    ];
    // 20 entries × 3 = 60 mainboard cards, all Briar-legal LL commons.
    const deck = makeDeck('briar-warden-of-thorns', briarLLCards);
    const result = computeDeckLegality(deck, catalog, 'Living Legend');
    expect(result.category).toBe('legal');
  });

  it('CC → Blitz format swap on non-young hero → illegal with hero-requirement reason', () => {
    // dorinthea-ironsong legalFormats does NOT include Blitz.
    // Step 1 short-circuits before pool/mainboard checks.
    const deck = makeDeck('dorinthea-ironsong', buildCC60());
    const result = computeDeckLegality(deck, catalog, 'Blitz');
    expect(result.category).toBe('illegal');
    expect(result.reasons[0]).toMatch(/Dorinthea Ironsong/);
    expect(result.reasons[0]).toMatch(/Blitz/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Copy-limit violations (step 4)
// ─────────────────────────────────────────────────────────────────────────────

describe('computeDeckLegality — copy limits (step 4)', () => {
  it('4× non-legendary card on CC → illegal naming the card', () => {
    // adrenaline-rush-red: Common, max 3 copies on CC.
    const mainboard = [
      { cardIdentifier: 'adrenaline-rush-red', quantity: 4 },
      ...buildCCMainboard(60).filter((row) => row.cardIdentifier !== 'adrenaline-rush-red').slice(0, 18),
    ];
    const deck = makeDeck('dorinthea-ironsong', mainboard);
    const result = computeDeckLegality(deck, catalog, 'Classic Constructed');
    expect(result.category).toBe('illegal');
    expect(result.reasons[0]).toMatch(/Adrenaline Rush/);
    expect(result.reasons[0]).toMatch(/4/);
  });

  it('Legendary card 2× on CC → illegal', () => {
    // amethyst-amulet-blue: Legendary keyword, Majestic rarity, legalHeroes includes Dorinthea.
    const mainboard = [
      { cardIdentifier: 'amethyst-amulet-blue', quantity: 2 },
      ...buildCCMainboard(58),
    ];
    const deck = makeDeck('dorinthea-ironsong', mainboard);
    const result = computeDeckLegality(deck, catalog, 'Classic Constructed');
    expect(result.category).toBe('illegal');
    expect(result.reasons[0]).toMatch(/Amethyst Amulet/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Per-card legality failures (step 5)
// ─────────────────────────────────────────────────────────────────────────────

describe('computeDeckLegality — per-card legality (step 5)', () => {
  it('banlisted card (bannedFormats includes Silver Age) → illegal in SA', () => {
    // aether-flare-red: bannedFormats: ['Silver Age']. kayo-berserker-runt is SA-legal.
    // aether-flare-red is also NOT in SA legalFormats, so step 5 catches it either way.
    const mainboard = [
      { cardIdentifier: 'aether-flare-red', quantity: 1 },
      ...buildBlitz40().slice(0, 39),
    ];
    const deck = makeDeck('kayo-berserker-runt', mainboard);
    const result = computeDeckLegality(deck, catalog, 'Silver Age');
    expect(result.category).toBe('illegal');
    expect(result.reasons[0]).toMatch(/Aether Flare/);
  });

  it('card with legalHeroes not including deck hero → illegal naming both card and hero', () => {
    // blood-drop-red: legalHeroes: ['Cindra', 'Fai'] — NOT Dorinthea.
    // agile-engagement cards ARE Dorinthea-legal, so only blood-drop-red is the violator.
    const mainboard = [
      { cardIdentifier: 'blood-drop-red', quantity: 1 },
      ...buildCCMainboard(59),
    ];
    const deck = makeDeck('dorinthea-ironsong', mainboard);
    const result = computeDeckLegality(deck, catalog, 'Classic Constructed');
    expect(result.category).toBe('illegal');
    expect(result.reasons[0]).toMatch(/Blood Drop/);
    expect(result.reasons[0]).toMatch(/Dorinthea Ironsong/);
  });

  it('card not legal for Dorinthea (aggressive-pounce Kayo-only pool) → illegal', () => {
    // aggressive-pounce-red: legalHeroes includes Kayo+Rhinar+Levia+RKO+Tuffnut, NOT Dorinthea.
    const mainboard = [
      { cardIdentifier: 'aggressive-pounce-red', quantity: 1 },
      ...buildCCMainboard(59),
    ];
    const deck = makeDeck('dorinthea-ironsong', mainboard);
    const result = computeDeckLegality(deck, catalog, 'Classic Constructed');
    expect(result.category).toBe('illegal');
    expect(result.reasons[0]).toMatch(/Aggressive Pounce/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Silver Age rarity whitelist (step 6)
// ─────────────────────────────────────────────────────────────────────────────

describe('computeDeckLegality — Silver Age rarity whitelist (step 6)', () => {
  it('SA: Majestic card (not in SA legalFormats) → illegal (caught at step 5 per-card legality)', () => {
    // amethyst-amulet-blue: Majestic, legalFormats = ['Blitz', 'Classic Constructed', 'Draft', 'Living Legend'] — NOT SA.
    // Step 5 catches it (not in legalFormats) before step 6 (rarity whitelist).
    const mainboard = [
      { cardIdentifier: 'amethyst-amulet-blue', quantity: 1 },
      ...buildBlitz40().slice(0, 39),
    ];
    const deck = makeDeck('kayo-berserker-runt', mainboard);
    const result = computeDeckLegality(deck, catalog, 'Silver Age');
    expect(result.category).toBe('illegal');
    expect(result.reasons[0]).toMatch(/Amethyst Amulet/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Result shape
// ─────────────────────────────────────────────────────────────────────────────

describe('computeDeckLegality — result shape', () => {
  it('legal result has empty reasons array', () => {
    const deck = makeDeck('dorinthea-ironsong', buildCC60());
    const result = computeDeckLegality(deck, catalog, 'Classic Constructed');
    expect(result.category).toBe('legal');
    expect(result.reasons).toEqual([]);
  });

  it('illegal result has at least one human-readable reason string', () => {
    const deck = makeDeck(null, []);
    const result = computeDeckLegality(deck, catalog, 'Classic Constructed');
    expect(result.category).toBe('illegal');
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(typeof result.reasons[0]).toBe('string');
    // First reason is user-readable (used as badge subtitle per R25).
    expect(result.reasons[0]!.length).toBeGreaterThan(10);
  });

  it('incomplete result has at least one human-readable reason string', () => {
    const deck = makeDeck('dorinthea-ironsong', []);
    const result = computeDeckLegality(deck, catalog, 'Classic Constructed');
    expect(result.category).toBe('incomplete');
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(typeof result.reasons[0]).toBe('string');
  });

  it('reasons is readonly (frozen)', () => {
    const deck = makeDeck('dorinthea-ironsong', []);
    const result = computeDeckLegality(deck, catalog, 'Classic Constructed');
    expect(Object.isFrozen(result.reasons)).toBe(true);
  });
});

describe('computeDeckLegality — structured reason details', () => {
  it('legal result has no details', () => {
    const result = computeDeckLegality(makeDeck('dorinthea-ironsong', buildCC60()), catalog, 'Classic Constructed');
    expect(result.details).toEqual([]);
  });

  it('mainboard under the minimum carries the counts', () => {
    const result = computeDeckLegality(makeDeck('dorinthea-ironsong', buildCCMainboard(58)), catalog, 'Classic Constructed');
    expect(result.details).toEqual([
      { code: 'mainboard_too_small', params: { card: null, count: 58, limit: 60, format: 'Classic Constructed' } },
    ]);
  });

  it('mainboard off the exact count carries the counts', () => {
    const deck = makeDeck('kayo-berserker-runt', buildBlitz40().slice(0, 39));
    const result = computeDeckLegality(deck, catalog, 'Blitz');
    expect(result.details).toEqual([
      { code: 'mainboard_not_exact', params: { card: null, count: 39, limit: 40, format: 'Blitz' } },
    ]);
  });

  it('unrecognized hero has a code with no params', () => {
    const result = computeDeckLegality(makeDeck(null, buildCC60()), catalog, 'Classic Constructed');
    expect(result.details).toEqual([{ code: 'hero_unrecognized', params: {} }]);
  });

  it('hero outside the format names the hero', () => {
    const result = computeDeckLegality(makeDeck('briar-warden-of-thorns', buildCC60()), catalog, 'Classic Constructed');
    expect(result.details[0]).toEqual({
      code: 'hero_not_legal',
      params: { hero: 'Briar, Warden of Thorns', format: 'Classic Constructed', allowedFormats: ['Living Legend'] },
    });
  });

  it('too many copies names the card and the limit', () => {
    const mainboard = [
      { cardIdentifier: 'adrenaline-rush-red', quantity: 4 },
      ...buildCCMainboard(60).filter((row) => row.cardIdentifier !== 'adrenaline-rush-red'),
    ];
    const result = computeDeckLegality(makeDeck('dorinthea-ironsong', mainboard), catalog, 'Classic Constructed');
    expect(result.details[0]).toMatchObject({
      code: 'too_many_copies',
      params: { card: 'Adrenaline Rush', count: 4, limit: 3, format: 'Classic Constructed' },
    });
  });

  it('card outside the hero names both', () => {
    const mainboard = [{ cardIdentifier: 'blood-drop-red', quantity: 1 }, ...buildCCMainboard(59)];
    const result = computeDeckLegality(makeDeck('dorinthea-ironsong', mainboard), catalog, 'Classic Constructed');
    expect(result.details).toEqual([
      {
        code: 'card_not_for_hero',
        params: { card: 'Blood Drop', cardIdentifier: 'blood-drop-red', hero: 'Dorinthea Ironsong' },
      },
    ]);
  });

  it('every reason string has exactly one detail', () => {
    const decks = [
      makeDeck(null, buildCC60()),
      makeDeck('dorinthea-ironsong', buildCCMainboard(10)),
      makeDeck('briar-warden-of-thorns', buildCC60()),
    ];
    for (const deck of decks) {
      const result = computeDeckLegality(deck, catalog, 'Classic Constructed');
      expect(result.details).toHaveLength(result.reasons.length);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Every problem at once, copies counted across the whole pool
// ─────────────────────────────────────────────────────────────────────────────

type TRow = ILegalityDeck['cards'][number];

const HERO_BY_FORMAT: Readonly<Record<TSupportedFormat, string>> = {
  'Classic Constructed': 'dorinthea-ironsong',
  'Living Legend': 'dorinthea-ironsong',
  Blitz: 'kayo-berserker-runt',
  'Silver Age': 'kayo-berserker-runt',
};

function heroRow(heroIdentifier: string): TRow {
  return { cardIdentifier: heroIdentifier, quantity: 1, slot: 'hero' };
}

function legalNonLegendaryCards(heroIdentifier: string, format: TSupportedFormat, count: number): readonly string[] {
  const hero = catalog.getCard(heroIdentifier);
  const picked = new Map<string, string>();
  for (const card of catalog.cards) {
    const key = `${card.name}|${card.pitch}`;
    const ordinary = !card.types.includes(Type.Hero) && !card.types.includes(Type.Token) && card.pitch !== null;
    const unrestricted = !card.keywords.includes(Keyword.Legendary) && (card.restrictedFormats ?? []).length === 0;
    if (ordinary && unrestricted && findCardLegalityViolation(card, hero, format) === null && !picked.has(key)) {
      picked.set(key, card.cardIdentifier);
    }
    if (picked.size === count) break;
  }
  return [...picked.values()];
}

function problemsOf(result: IDeckLegalityResult, code: string): readonly TLegalityReasonDetail[] {
  return result.details.filter((detail) => detail.code === code);
}

describe('computeDeckLegality — copy limit counts deck, inventory, weapons and equipment in every format', () => {
  const LIMITS: ReadonlyArray<readonly [TSupportedFormat, number]> = [
    ['Classic Constructed', 3],
    ['Living Legend', 3],
    ['Silver Age', 2],
    ['Blitz', 1],
  ];

  function spreadCopies(cardIdentifier: string, copies: number): TRow[] {
    const places = [0, 0, 0, 0];
    for (let copy = 0; copy < copies; copy += 1) places[copy % 4] = (places[copy % 4] ?? 0) + 1;
    const [deckCopies = 0, inventoryCopies = 0, weaponCopies = 0, equipmentCopies = 0] = places;
    return [
      { cardIdentifier, quantity: deckCopies, slot: 'mainboard', inventoryQuantity: inventoryCopies },
      { cardIdentifier, quantity: weaponCopies, slot: 'weapon' },
      { cardIdentifier, quantity: equipmentCopies, slot: 'equipment' },
    ];
  }

  it.each(
    LIMITS.flatMap(([format, limit]) => [
      { format, copies: limit, expectedProblems: 0, limit },
      { format, copies: limit + 1, expectedProblems: 1, limit },
    ]),
  )(
    '$format with $copies copies split over the four places gives $expectedProblems copy problems',
    ({ format, copies, expectedProblems, limit }) => {
      const heroIdentifier = HERO_BY_FORMAT[format];
      const deck: ILegalityDeck = {
        heroIdentifier,
        cards: [heroRow(heroIdentifier), ...spreadCopies('adrenaline-rush-red', copies)],
      };

      const problems = problemsOf(computeDeckLegality(deck, catalog, format), 'too_many_copies');

      expect(problems).toHaveLength(expectedProblems);
      if (expectedProblems === 1) {
        expect(problems[0]).toMatchObject({
          params: { card: 'Adrenaline Rush', cardIdentifier: 'adrenaline-rush-red', count: copies, limit, format },
        });
      }
    },
  );

  it('3 deck + 1 inventory in Classic Constructed counts 4 against 3', () => {
    const deck: ILegalityDeck = {
      heroIdentifier: 'dorinthea-ironsong',
      cards: [{ cardIdentifier: 'adrenaline-rush-red', quantity: 3, slot: 'mainboard', inventoryQuantity: 1 }],
    };

    const problems = problemsOf(computeDeckLegality(deck, catalog, 'Classic Constructed'), 'too_many_copies');

    expect(problems).toEqual([
      {
        code: 'too_many_copies',
        params: {
          card: 'Adrenaline Rush',
          cardIdentifier: 'adrenaline-rush-red',
          pitch: 1,
          count: 4,
          limit: 3,
          format: 'Classic Constructed',
          legendary: false,
          restricted: false,
        },
      },
    ]);
  });

  it('copies are counted per name and pitch', () => {
    const blitz = (rows: ReadonlyArray<readonly [string, number]>): IDeckLegalityResult =>
      computeDeckLegality(
        {
          heroIdentifier: 'rhinar',
          cards: [heroRow('rhinar'), ...rows.map(([cardIdentifier, quantity]): TRow => ({ cardIdentifier, quantity, slot: 'mainboard' }))],
        },
        catalog,
        'Blitz',
      );

    expect(problemsOf(blitz([['pack-hunt-red', 1], ['pack-hunt-yellow', 1]]), 'too_many_copies')).toEqual([]);

    const over = problemsOf(blitz([['pack-hunt-red', 2], ['pack-hunt-yellow', 1]]), 'too_many_copies');
    expect(over).toHaveLength(1);
    expect(over[0]).toMatchObject({ params: { card: 'Pack Hunt', cardIdentifier: 'pack-hunt-red', count: 2, limit: 1 } });
  });
});

describe('computeDeckLegality — card pool limit per format without the hero', () => {
  it.each([
    ['Classic Constructed', 80, 0],
    ['Classic Constructed', 81, 1],
    ['Living Legend', 80, 0],
    ['Living Legend', 81, 1],
    ['Blitz', 52, 0],
    ['Blitz', 53, 1],
    ['Silver Age', 55, 0],
    ['Silver Age', 56, 1],
  ] as const)('%s with %i cards in the pool gives %i pool problems', (format, poolSize, expectedProblems) => {
    const heroIdentifier = HERO_BY_FORMAT[format];
    const cardIds = legalNonLegendaryCards(heroIdentifier, format, poolSize);
    const rows: TRow[] = cardIds.map((cardIdentifier, index): TRow =>
      index % 2 === 0
        ? { cardIdentifier, quantity: 1, slot: 'mainboard' }
        : { cardIdentifier, quantity: 0, slot: 'mainboard', inventoryQuantity: 1 },
    );
    expect(rows).toHaveLength(poolSize);

    const result = computeDeckLegality({ heroIdentifier, cards: [heroRow(heroIdentifier), ...rows] }, catalog, format);

    const problems = problemsOf(result, 'card_pool_too_large');
    expect(problems).toHaveLength(expectedProblems);
    if (expectedProblems === 1) {
      expect(problems[0]).toEqual({
        code: 'card_pool_too_large',
        params: { card: null, count: poolSize, limit: poolSize - 1, format },
      });
    }
  });

  it.each([
    ['Classic Constructed', 80, 0],
    ['Classic Constructed', 81, 1],
    ['Living Legend', 80, 0],
    ['Living Legend', 81, 1],
    ['Blitz', 52, 0],
    ['Blitz', 53, 1],
    ['Silver Age', 55, 0],
    ['Silver Age', 56, 1],
  ] as const)('%s with %i cards in the pool, a weapon and an equipment among them, gives %i pool problems', (format, poolSize, expectedProblems) => {
    const heroIdentifier = HERO_BY_FORMAT[format];
    const [weapon, equipment, ...others] = legalNonLegendaryCards(heroIdentifier, format, poolSize) as readonly string[];
    const rows: TRow[] = [
      { cardIdentifier: weapon!, quantity: 1, slot: 'weapon' },
      { cardIdentifier: equipment!, quantity: 1, slot: 'equipment' },
      ...others.map((cardIdentifier, index): TRow =>
        index % 2 === 0
          ? { cardIdentifier, quantity: 1, slot: 'mainboard' }
          : { cardIdentifier, quantity: 0, slot: 'mainboard', inventoryQuantity: 1 },
      ),
    ];
    expect(rows).toHaveLength(poolSize);

    const result = computeDeckLegality({ heroIdentifier, cards: [heroRow(heroIdentifier), ...rows] }, catalog, format);

    const problems = problemsOf(result, 'card_pool_too_large');
    expect(problems).toHaveLength(expectedProblems);
    if (expectedProblems === 1) {
      expect(problems[0]).toEqual({
        code: 'card_pool_too_large',
        params: { card: null, count: poolSize, limit: poolSize - 1, format },
      });
    }
  });
});

describe('computeDeckLegality — every check runs and every problem is returned', () => {
  it('a Blitz deck at 31 of 40 with Pack Hunt (Red) x2 returns the size problem and the copy problem', () => {
    const others = legalNonLegendaryCards('rhinar', 'Blitz', 40).filter((id) => id !== 'pack-hunt-red' && id !== 'pack-hunt-yellow' && id !== 'pack-hunt-blue');
    const rows: TRow[] = [
      { cardIdentifier: 'pack-hunt-red', quantity: 2, slot: 'mainboard' },
      ...others.slice(0, 29).map((cardIdentifier): TRow => ({ cardIdentifier, quantity: 1, slot: 'mainboard' })),
    ];

    const result = computeDeckLegality({ heroIdentifier: 'rhinar', cards: [heroRow('rhinar'), ...rows] }, catalog, 'Blitz');

    expect(result.category).toBe('illegal');
    expect(result.details).toEqual([
      {
        code: 'too_many_copies',
        params: {
          card: 'Pack Hunt',
          cardIdentifier: 'pack-hunt-red',
          pitch: 1,
          count: 2,
          limit: 1,
          format: 'Blitz',
          legendary: false,
          restricted: false,
        },
      },
      { code: 'mainboard_not_exact', params: { card: null, count: 31, limit: 40, format: 'Blitz' } },
    ]);
    expect(result.reasons).toHaveLength(2);
  });

  function withOneCopyTooMany(total: number): Array<{ cardIdentifier: string; quantity: number }> {
    const rows = buildCCMainboard(total);
    return rows
      .map((row, index) => {
        if (index === 0) return { ...row, quantity: row.quantity + 1 };
        if (index === rows.length - 1) return { ...row, quantity: row.quantity - 1 };
        return row;
      })
      .filter((row) => row.quantity > 0);
  }

  it.each([
    { label: 'no problem', mainboard: buildCCMainboard(60), category: 'legal' },
    { label: 'only the size', mainboard: buildCCMainboard(58), category: 'incomplete' },
    { label: 'a rule problem with the size full', mainboard: withOneCopyTooMany(60), category: 'illegal' },
    { label: 'a rule problem with the size short', mainboard: withOneCopyTooMany(58), category: 'illegal' },
  ] as const)('category from the set of problems: $label gives $category', ({ mainboard, category }) => {
    const result = computeDeckLegality(makeDeck('dorinthea-ironsong', [...mainboard]), catalog, 'Classic Constructed');

    expect(result.category).toBe(category);
  });
});

describe('computeDeckLegality — hero and format edges', () => {
  it('a hero outside the format names where it is allowed', () => {
    const result = computeDeckLegality(makeDeck('briar-warden-of-thorns', buildCC60()), catalog, 'Classic Constructed');

    const [heroProblem] = problemsOf(result, 'hero_not_legal');
    expect(heroProblem).toEqual({
      code: 'hero_not_legal',
      params: { hero: 'Briar, Warden of Thorns', format: 'Classic Constructed', allowedFormats: ['Living Legend'] },
    });
    expect(problemsOf(result, 'hero_not_legal')).toHaveLength(1);
  });

  it('allowed formats follow the four-format order for a hero in several of them', () => {
    const result = computeDeckLegality(makeDeck('dorinthea-ironsong', buildCC60()), catalog, 'Blitz');

    expect(problemsOf(result, 'hero_not_legal')[0]).toMatchObject({
      params: { allowedFormats: ['Classic Constructed', 'Living Legend'] },
    });
  });

  it('an unknown format is unchecked', () => {
    const result = computeDeckLegality(makeDeck('dorinthea-ironsong', buildCC60()), catalog, 'Draft');

    expect(result).toEqual({ category: 'unchecked', reasons: [], details: [] });
  });

  it('a hero row is not counted in the pool or the copies', () => {
    const deck = makeDeck('dorinthea-ironsong', buildCC60());

    const result = computeDeckLegality(deck, catalog, 'Classic Constructed');

    expect(deck.cards.some((card) => card.slot === 'hero')).toBe(true);
    expect(result.category).toBe('legal');
  });
});

describe('computeDeckLegalityInOtherFormats', () => {
  function kayoLivingLegendCardIds(): string[] {
    return [...catalog.indices.byIdentifier.values()]
      .filter(
        (card) =>
          card.legalHeroes.includes('Kayo') &&
          (card.legalFormats as readonly string[]).includes('Classic Constructed') &&
          (card.legalFormats as readonly string[]).includes('Living Legend') &&
          (card.bannedFormats ?? []).length === 0 &&
          (card.restrictedFormats ?? []).length === 0 &&
          !card.keywords.includes(Keyword.Legendary) &&
          !card.types.some((type) => [Type.Hero, Type.Weapon, Type.Equipment].includes(type)),
      )
      .map((card) => card.cardIdentifier)
      .sort()
      .slice(0, 20);
  }

  function retiredHeroDeck(): ILegalityDeck {
    return Object.freeze({
      heroIdentifier: 'kayo-armed-and-dangerous',
      cards: Object.freeze([
        { cardIdentifier: 'kayo-armed-and-dangerous', quantity: 1, slot: 'hero' },
        { cardIdentifier: 'mandible-claw', quantity: 2, slot: 'weapon' },
        ...kayoLivingLegendCardIds().map((cardIdentifier) => ({ cardIdentifier, quantity: 3, slot: 'mainboard' })),
      ]),
    });
  }

  it('a deck is evaluated in every other format', () => {
    const deck = retiredHeroDeck();

    const verdicts = computeDeckLegalityInOtherFormats(deck, catalog, 'Classic Constructed');
    const own = computeDeckLegality(deck, catalog, 'Classic Constructed');

    expect(verdicts.map((verdict) => verdict.format)).toEqual(['Blitz', 'Living Legend', 'Silver Age']);
    expect(own.category).toBe('illegal');
    expect(own.details.map((detail) => detail.code)).toEqual(expect.arrayContaining(['hero_not_legal', 'card_banned']));
    const livingLegend = verdicts.find((verdict) => verdict.format === 'Living Legend');
    expect(livingLegend?.category).toBe('legal');
    expect(livingLegend?.details).toEqual([]);
    const blitz = verdicts.find((verdict) => verdict.format === 'Blitz');
    expect(blitz?.category).toBe('illegal');
    expect(blitz?.details.map((detail) => detail.code)).toContain('hero_not_legal');
  });
});
