import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { test } from 'node:test';
import { catalog, Format, Rarity, Type } from '../../../packages/engine/src';
import type { ICatalogCard, TSupportedFormat } from '../../../packages/engine/src';
import { buildPool, isCardInPool } from '../lib/pool-filter';
import type { IDeckFile } from '../lib/types';
import { listFiles, runCli, tempDir } from './helpers';

const CC: TSupportedFormat = 'Classic Constructed';
const dorinthea = catalog.getCard('dorinthea-ironsong');

function variant(base: ICatalogCard, patch: Record<string, unknown>): ICatalogCard {
  return { ...base, ...patch } as ICatalogCard;
}

function deckOf(hero: string, format: string, cards: string[]): IDeckFile {
  return {
    deck: 'TESTDECK',
    url: 'https://fabrary.net/decks/TESTDECK',
    name: 'Test',
    hero,
    format,
    mainboard: cards.map((card) => ({ card, quantity: 1 })),
  };
}

test('C7: each per-card test of step 5 and the Silver Age rarity list is applied, and Dorinthea in CC has 1,017 non-hero cards', () => {
  const generic = catalog.getCard('snatch-red');
  assert.equal(isCardInPool(generic, dorinthea, CC), true);

  assert.equal(isCardInPool(variant(generic, { bannedFormats: [Format.ClassicConstructed] }), dorinthea, CC), false);
  assert.equal(isCardInPool(variant(generic, { legalFormats: [] }), dorinthea, CC), false);

  const heroOnly = variant(generic, { legalHeroes: ['Kayo'] });
  assert.equal(isCardInPool(heroOnly, dorinthea, CC), false);
  assert.equal(isCardInPool(variant(heroOnly, { legalHeroes: ['Dorinthea'] }), dorinthea, CC), true);
  const override = { format: Format.ClassicConstructed, heroes: ['Dorinthea'] };
  assert.equal(isCardInPool(variant(heroOnly, { legalOverrides: [override] }), dorinthea, CC), true);
  const otherFormatOverride = { format: Format.Blitz, heroes: ['Dorinthea'] };
  assert.equal(isCardInPool(variant(heroOnly, { legalOverrides: [otherFormatOverride] }), dorinthea, CC), false);
  assert.equal(isCardInPool(variant(heroOnly, { specializations: ['Dorinthea'] }), dorinthea, CC), true);

  const youngHero = catalog.cards.find((c) => c.types.includes(Type.Hero) && c.young && c.legalFormats.includes(Format.SilverAge));
  assert.ok(youngHero);
  const SA: TSupportedFormat = 'Silver Age';
  assert.equal(isCardInPool(variant(generic, { rarity: Rarity.Common, legalFormats: [Format.SilverAge] }), youngHero, SA), true);
  assert.equal(isCardInPool(variant(generic, { rarity: Rarity.Majestic, legalFormats: [Format.SilverAge] }), youngHero, SA), false);

  const passing = catalog.cards.filter((c) => !c.types.includes(Type.Hero) && isCardInPool(c, dorinthea, CC));
  assert.equal(passing.length, 1017);
});

test('C8: the pool drops hero cards, tokens and cards already in the deck, and states its size', () => {
  const token = catalog.cards.find((c) => c.types.includes(Type.Token) && isCardInPool(c, dorinthea, CC));
  const heroCard = catalog.cards.find((c) => c.types.includes(Type.Hero) && isCardInPool(c, dorinthea, CC));
  assert.ok(token, 'a legal token exists for the check');
  assert.ok(heroCard, 'a legal hero card exists for the check');

  const deck = deckOf('dorinthea-ironsong', CC, ['snatch-red', 'sink-below-red']);
  const pool = buildPool(deck, catalog);

  for (const excluded of ['snatch-red', 'sink-below-red', token.cardIdentifier, heroCard.cardIdentifier]) {
    assert.equal(pool.cards.includes(excluded), false, `${excluded} must be excluded`);
  }
  assert.equal(pool.size, pool.cards.length);
  assert.ok(pool.cards.includes('toughen-up-blue'));
});

test('C9: a pool under 10 cards exits 1 naming the deck, and 10 does not', () => {
  const youngHero = 'azalea';
  const out = tempDir();
  const deckFile = deckOf(youngHero, 'Silver Age', []);
  mkdirSync(join(out, 'decks'), { recursive: true });

  // A pool is exactly as large as the catalog allows; shrink it by putting all but N of its cards in the deck.
  for (const [keep, expectedStatus] of [[9, 1], [10, 0]] as const) {
    const full = buildPool(deckFile, catalog).cards;
    const deck = deckOf(youngHero, 'Silver Age', full.slice(0, full.length - keep));
    writeFileSync(join(out, 'decks', 'TESTDECK.json'), JSON.stringify(deck));

    const result = runCli('pool.ts', [], { SYNERGY_OUT_DIR: out });

    assert.equal(result.status, expectedStatus, result.stderr);
    if (expectedStatus === 1) {
      assert.match(result.stderr, /TESTDECK/);
      assert.deepEqual(listFiles(join(out, 'pools')), []);
    } else {
      const written = JSON.parse(readFileSync(join(out, 'pools', 'TESTDECK.json'), 'utf8'));
      assert.equal(written.size, 10);
    }
  }
});
