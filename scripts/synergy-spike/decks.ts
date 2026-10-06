import { readFileSync } from 'fs';
import { parse as parseYaml } from 'yaml';
import { catalog } from '../../packages/engine/src';
import { fetchDeck } from '../gold-set/fetch-deck';
import { loadDecks } from './lib/deck-loader';
import { decksFile, outDir } from './lib/paths';

async function main(): Promise<void> {
  const config = parseYaml(readFileSync(decksFile(), 'utf8')) as { decks?: string[] } | null;
  const urls = config?.decks ?? [];
  const result = await loadDecks(urls, fetchDeck, catalog, outDir());

  for (const path of result.written) console.log(`wrote ${path}`);
  for (const error of result.errors) console.error(error);
  process.exit(result.errors.length > 0 ? 1 : 0);
}

void main();
