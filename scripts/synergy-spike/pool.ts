import { catalog } from '../../packages/engine/src';
import { readDecks, writeJson } from './lib/io';
import { outDir } from './lib/paths';
import { buildPool } from './lib/pool-filter';
import { join } from 'path';

const MINIMUM_POOL_SIZE = 10;

function main(): void {
  const out = outDir();
  const decks = readDecks(out);
  if (decks.length === 0) {
    console.error('no decks found: run `pnpm synergy:decks` first');
    process.exit(1);
  }

  const pools = decks.map((deck) => ({ deck, pool: buildPool(deck, catalog) }));
  const tooSmall = pools.filter(({ pool }) => pool.size < MINIMUM_POOL_SIZE);
  for (const { deck, pool } of tooSmall) {
    console.error(`deck ${deck.deck} (${deck.name}): pool holds ${pool.size} cards, fewer than ${MINIMUM_POOL_SIZE}`);
  }
  if (tooSmall.length > 0) process.exit(1);

  for (const { deck, pool } of pools) {
    writeJson(join(out, 'pools', `${deck.deck}.json`), pool);
    console.log(`${deck.deck} ${deck.name}: pool of ${pool.size} cards`);
  }
}

main();
