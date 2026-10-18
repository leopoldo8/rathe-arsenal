import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildCardSet, distinctIdentifiers } from '../lib/card-set';
import { classifyPrinting, computeCoverage, summarize } from '../lib/coverage';
import { buildPriceIndex } from '../lib/tcgcsv';
import type { IPriceRow } from '../lib/types';

const row = (productId: number, subTypeName: string, marketPrice: number | null): IPriceRow => ({
  productId,
  subTypeName,
  lowPrice: 1,
  midPrice: 1,
  highPrice: 1,
  marketPrice,
  directLowPrice: null,
});

const RAW = {
  'card-a': {
    name: 'Card A',
    printings: [
      { identifier: 'A1', set: 'S', rarity: 'Common', tcgplayer: { productId: '10', url: 'u' } },
      { identifier: 'A1', set: 'S', rarity: 'Common', foiling: 'Rainbow', tcgplayer: { productId: '10', url: 'u' } },
    ],
  },
  'card-b': { name: 'Card B', printings: [{ identifier: 'B1', set: 'S', rarity: 'Rare' }] },
  'card-c': {
    name: 'Card C',
    printings: [{ identifier: 'C1', set: 'S', rarity: 'Rare', foiling: 'Cold', tcgplayer: { productId: '30', url: 'u' } }],
  },
} as const;

const getRaw = (id: string): unknown => RAW[id as keyof typeof RAW];

test('distinctIdentifiers merges decks and includes the hero once', () => {
  const ids = distinctIdentifiers([
    { hero: 'h', mainboard: [{ card: 'b' }, { card: 'a' }] },
    { hero: 'h', mainboard: [{ card: 'a' }] },
  ]);
  assert.deepEqual(ids, ['a', 'b', 'h']);
});

test('computeCoverage prefers the normal printing and counts cards with no price', () => {
  const index = buildPriceIndex([row(10, 'Normal', 0.5), row(10, 'Rainbow Foil', 4), row(30, 'Cold Foil', null)]);
  const cardSet = buildCardSet(['card-a', 'card-b', 'card-c'], getRaw);
  const coverage = computeCoverage(cardSet, index);

  assert.equal(coverage[0]?.best?.row.subTypeName, 'Normal');
  assert.equal(coverage[0]?.printingsPriced, 2);
  assert.equal(coverage[1]?.best, null);
  assert.equal(coverage[2]?.best, null);
  assert.deepEqual(summarize(coverage), { cards: 3, cardsPriced: 1, printings: 4, printingsPriced: 2 });
});

test('classifyPrinting tells a missing product id from a missing row and a null market price', () => {
  const index = buildPriceIndex([row(30, 'Cold Foil', null)]);
  const [a, b, c] = buildCardSet(['card-a', 'card-b', 'card-c'], getRaw);
  assert.equal(classifyPrinting(b!.printings[0]!, index), 'no-product-id');
  assert.equal(classifyPrinting(a!.printings[0]!, index), 'no-price-row');
  assert.equal(classifyPrinting(c!.printings[0]!, index), 'market-null');
});
