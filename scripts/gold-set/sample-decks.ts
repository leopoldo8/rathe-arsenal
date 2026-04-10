import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';
import { fetchDeck } from './fetch-deck';

const FIXTURES_PATH = join(__dirname, 'fixtures', 'sampled-decks.yaml');
const OUT_DIR = join(__dirname, 'out', 'sampled');

function extractUlid(url: string): string {
  const match = url.match(/fabrary\.net\/decks\/([A-Za-z0-9]+)/);
  if (!match?.[1]) {
    throw new Error(`Cannot extract ULID from URL: ${url}`);
  }
  return match[1].toUpperCase();
}

async function main(): Promise<void> {
  console.log('Reading sampled-decks.yaml...');
  const raw = readFileSync(FIXTURES_PATH, 'utf8');
  const config = parseYaml(raw) as { decks: string[] };

  if (!config.decks || config.decks.length === 0) {
    console.error('No deck URLs found in fixtures/sampled-decks.yaml');
    process.exit(1);
  }

  const urls = config.decks.filter(
    (u) => !u.includes('REPLACE_WITH'),
  );

  if (urls.length === 0) {
    console.error('All URLs are placeholders. Replace them with real Fabrary deck URLs.');
    process.exit(1);
  }

  console.log(`Found ${urls.length} deck URLs.`);

  mkdirSync(OUT_DIR, { recursive: true });

  for (const url of urls) {
    const ulid = extractUlid(url);
    console.log(`\nFetching deck ${ulid}...`);

    try {
      const deck = await fetchDeck(ulid);
      const outPath = join(OUT_DIR, `${ulid}.json`);
      writeFileSync(outPath, JSON.stringify(deck, null, 2));
      console.log(`  -> ${deck.name} (${deck.hero.name}, ${deck.format})`);
      console.log(`     ${deck.deckCards.length} card entries, saved to ${outPath}`);
    } catch (error) {
      console.error(`  ERROR fetching ${ulid}: ${(error as Error).message}`);
    }
  }

  console.log('\nDone.');
}

void main();
