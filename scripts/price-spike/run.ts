import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { catalog } from '../../packages/engine/src';
import { buildCardSet, distinctIdentifiers, type IDeckCards } from './lib/card-set';
import { computeCoverage, countPrintingStatuses, summarize } from './lib/coverage';
import { fetchJsonCached } from './lib/fetch-cached';
import { DECKS_DIR, outDir } from './lib/paths';
import { buildPriceIndex, groupsUrl, parseGroupIds, parsePriceRows, pricesUrl } from './lib/tcgcsv';
import type { IPriceRow } from './lib/types';

function rarityBreakdown(
  cardSet: ReturnType<typeof buildCardSet>,
  coverage: ReturnType<typeof computeCoverage>,
): Record<string, { cards: number; priced: number }> {
  const result: Record<string, { cards: number; priced: number }> = {};
  cardSet.forEach((card, i) => {
    const rarity = card.printings[0]?.rarity ?? 'Unknown';
    const entry = result[rarity] ?? { cards: 0, priced: 0 };
    result[rarity] = { cards: entry.cards + 1, priced: entry.priced + (coverage[i]?.best ? 1 : 0) };
  });
  return result;
}

async function main(): Promise<void> {
  const out = outDir();
  const decks = readdirSync(DECKS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(DECKS_DIR, f), 'utf8')) as IDeckCards);
  const cardSet = buildCardSet(distinctIdentifiers(decks), (id) => catalog.getRawCard(id));

  const groupIds = parseGroupIds(await fetchJsonCached(groupsUrl(), join(out, 'tcgcsv', 'groups.json')));
  const rows: IPriceRow[] = [];
  for (const groupId of groupIds) {
    const json = await fetchJsonCached(pricesUrl(groupId), join(out, 'tcgcsv', `prices-${groupId}.json`));
    rows.push(...parsePriceRows(json));
  }

  const index = buildPriceIndex(rows);
  const coverage = computeCoverage(cardSet, index);
  const subTypes = rows.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.subTypeName]: (acc[r.subTypeName] ?? 0) + 1 }), {});
  const report = {
    fetchedOn: new Date().toISOString(),
    groups: groupIds.length,
    priceRows: rows.length,
    priceRowsWithMarket: rows.filter((r) => r.marketPrice !== null).length,
    subTypes,
    ...summarize(coverage),
    printingStatuses: countPrintingStatuses(cardSet, index),
    byRarity: rarityBreakdown(cardSet, coverage),
    unpriced: coverage.filter((c) => c.best === null).map((c) => c.cardIdentifier),
    coverage,
  };
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'coverage.json'), `${JSON.stringify(report, null, 2)}\n`);
  const { coverage: _omit, ...headline } = report;
  console.log(JSON.stringify(headline, null, 2));
}

void main();
