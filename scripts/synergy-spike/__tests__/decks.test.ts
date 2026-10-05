import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { test } from 'node:test';
import { catalog } from '../../../packages/engine/src';
import type { IRawDeck } from '../../gold-set/fetch-deck';
import { loadDecks } from '../lib/deck-loader';
import { listFiles, runCli, tempDir } from './helpers';

const URLS = [
  'https://fabrary.net/decks/01m2ea2j62qde6zzyp0ypxebg4',
  'https://fabrary.net/decks/01M0KJEX07FX04Z07EQ1TESWYP',
  'https://fabrary.net/decks/01M2GEPE0X50C32E02KZNXAETH',
];

function rawDeck(overrides: Partial<IRawDeck> = {}): IRawDeck {
  return {
    deckId: 'X',
    name: 'Test deck',
    format: 'Classic Constructed',
    heroIdentifier: 'dorinthea-ironsong',
    hero: { cardIdentifier: 'dorinthea-ironsong', name: 'Dorinthea Ironsong' },
    deckCards: [
      { cardIdentifier: 'snatch-red', quantity: 3, sideboardQuantity: 0 },
      { cardIdentifier: 'sink-below-red', quantity: 2, sideboardQuantity: 1 },
      { cardIdentifier: 'toughen-up-blue', quantity: 0, sideboardQuantity: 2 },
    ],
    ...overrides,
  };
}

test('C4: writes one file per deck holding hero, format and mainboard entries with quantity above 0', async () => {
  const out = tempDir();
  const result = await loadDecks(URLS, async () => rawDeck(), catalog, out);

  assert.deepEqual(result.errors, []);
  assert.deepEqual(listFiles(join(out, 'decks')), [
    '01M0KJEX07FX04Z07EQ1TESWYP.json',
    '01M2EA2J62QDE6ZZYP0YPXEBG4.json',
    '01M2GEPE0X50C32E02KZNXAETH.json',
  ]);
  const deck = JSON.parse(readFileSync(join(out, 'decks', '01M2EA2J62QDE6ZZYP0YPXEBG4.json'), 'utf8'));
  assert.equal(deck.hero, 'dorinthea-ironsong');
  assert.equal(deck.format, 'Classic Constructed');
  assert.deepEqual(deck.mainboard, [
    { card: 'snatch-red', quantity: 3 },
    { card: 'sink-below-red', quantity: 2 },
  ]);
});

test('C5: fewer than three URLs exit 1 with a message and write no file', () => {
  for (const count of [2, 1]) {
    const out = tempDir();
    const file = join(tempDir(), 'decks.yaml');
    writeFileSync(file, `decks:\n${URLS.slice(0, count).map((u) => `  - ${u}`).join('\n')}\n`);

    const result = runCli('decks.ts', [], { SYNERGY_DECKS_FILE: file, SYNERGY_OUT_DIR: out });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /three are required/);
    assert.deepEqual(listFiles(out), []);
  }
});

test('C6: a failed fetch and an identifier absent from the catalog each name the deck, write no file and error', async () => {
  const out = tempDir();
  const fetcher = async (ulid: string): Promise<IRawDeck> => {
    if (ulid === '01M0KJEX07FX04Z07EQ1TESWYP') throw new Error('Fabrary fetch failed: 404');
    return rawDeck({
      deckCards: [{ cardIdentifier: 'not-a-real-card-xyz', quantity: 3, sideboardQuantity: 0 }],
    });
  };

  const result = await loadDecks(URLS, fetcher, catalog, out);

  assert.equal(result.errors.length, 3);
  assert.ok(result.errors.some((e) => e.includes(URLS[1] as string) && e.includes('404')));
  assert.ok(result.errors.some((e) => e.includes(URLS[0] as string) && e.includes('not-a-real-card-xyz')));
  assert.deepEqual(listFiles(out), []);
});

test('C6: the CLI exits 1, prints the deck URL and writes no file when a listed deck cannot be loaded', () => {
  const out = tempDir();
  const bad = 'https://fabrary.net/not-a-deck-page';
  const file = join(tempDir(), 'decks.yaml');
  writeFileSync(file, `decks:\n  - ${bad}\n  - ${bad}/2\n  - ${bad}/3\n`);

  const result = runCli('decks.ts', [], { SYNERGY_DECKS_FILE: file, SYNERGY_OUT_DIR: out });

  assert.equal(result.status, 1);
  assert.ok(result.stderr.includes(bad));
  assert.deepEqual(listFiles(out), []);
});
