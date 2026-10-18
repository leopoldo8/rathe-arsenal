import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPriceIndex, foilingToSubType, parseGroupIds, parsePriceRows, priceKey } from '../lib/tcgcsv';

test('parseGroupIds keeps numeric group ids and tolerates a missing results list', () => {
  assert.deepEqual(parseGroupIds({ results: [{ groupId: 1 }, { groupId: 'x' }, {}] }), [1]);
  assert.deepEqual(parseGroupIds({}), []);
  assert.deepEqual(parseGroupIds(null), []);
});

test('parsePriceRows maps null and missing prices to null and drops malformed rows', () => {
  const rows = parsePriceRows({
    results: [
      { productId: 7, subTypeName: 'Normal', lowPrice: 0.5, midPrice: 0.6, highPrice: 9, marketPrice: null, directLowPrice: null },
      { productId: 8 },
      { subTypeName: 'Normal' },
    ],
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.marketPrice, null);
  assert.equal(rows[0]?.lowPrice, 0.5);
});

test('foilingToSubType names finishes and editions the way tcgcsv does', () => {
  assert.equal(foilingToSubType('Standard'), 'Normal');
  assert.equal(foilingToSubType('Rainbow'), 'Rainbow Foil');
  assert.equal(foilingToSubType('Cold', 'First'), '1st Edition Cold Foil');
  assert.equal(foilingToSubType('Standard', 'Unlimited'), 'Unlimited Edition Normal');
});

test('buildPriceIndex keys rows by product id and sub type', () => {
  const index = buildPriceIndex([
    { productId: 1, subTypeName: 'Normal', lowPrice: 1, midPrice: 1, highPrice: 1, marketPrice: 1, directLowPrice: null },
  ]);
  assert.equal(index.get(priceKey(1, 'Normal'))?.marketPrice, 1);
  assert.equal(index.get(priceKey(1, 'Rainbow Foil')), undefined);
});
