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

import { computeDeckLegality } from '../../src/legality/compute';
import { catalog } from '../../src/catalog/catalog';
import type { ILegalityDeck } from '../../src/legality/types';

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
      ...buildCCMainboard(56),
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
