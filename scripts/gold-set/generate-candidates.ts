import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import {
  catalog,
  findTierMatch,
  TIER_1_CONFIG,
  Type,
} from '../../packages/engine/src';
import type { ICatalogCard } from '../../packages/engine/src';
import type { IRawDeck } from './fetch-deck';

const SAMPLED_DIR = join(__dirname, 'out', 'sampled');
const OUT_DIR = join(__dirname, 'out');
const TARGET_CANDIDATES = 30;

interface ICandidate {
  rowNumber: number;
  deckHero: string;
  deckName: string;
  originalCard: string;
  originalCardName: string;
  proposedSubstitute: string;
  proposedSubstituteName: string;
  engineTier: number;
  engineScore: number;
  rationale: string;
}

/**
 * Deterministic depletion: mark every Nth mainboard card as missing.
 * Uses a step-based approach (not random) for reproducibility.
 */
function depleteInventory(
  deckCards: IRawDeck['deckCards'],
  depletionRate: number,
): { owned: Map<string, number>; missing: Array<{ cardIdentifier: string; quantity: number }> } {
  const mainboardCards = deckCards.filter(
    (c) => c.quantity > 0 && c.sideboardQuantity === 0,
  );

  const owned = new Map<string, number>();
  const missing: Array<{ cardIdentifier: string; quantity: number }> = [];

  // First pass: add all cards to inventory
  for (const card of mainboardCards) {
    owned.set(card.cardIdentifier, card.quantity);
  }

  // Second pass: deterministically deplete ~depletionRate of unique cards
  const step = Math.max(1, Math.round(1 / depletionRate));
  for (let i = 0; i < mainboardCards.length; i++) {
    if (i % step === 0) {
      const card = mainboardCards[i]!;
      owned.delete(card.cardIdentifier);
      missing.push({
        cardIdentifier: card.cardIdentifier,
        quantity: card.quantity,
      });
    }
  }

  return { owned, missing };
}

/**
 * Build a synthetic inventory from the full catalog for the deck's hero class.
 * This gives the engine candidates to substitute from.
 */
function buildSyntheticInventory(
  owned: Map<string, number>,
  heroCard: ICatalogCard | undefined,
): Map<string, number> {
  const inventory = new Map(owned);

  // Add all cards from the catalog that share a class with the hero's legal cards
  const heroClasses = heroCard?.classes ?? [];
  for (const card of catalog.cards) {
    if (inventory.has(card.cardIdentifier)) continue;

    // Only add cards that share a class with the deck's hero
    const sharesClass =
      heroClasses.length === 0 ||
      card.classes.some((c) => heroClasses.includes(c)) ||
      card.classes.some((c) => c === ('Generic' as typeof c));

    if (sharesClass && !card.types.includes(Type.Hero)) {
      inventory.set(card.cardIdentifier, 3); // Assume 3 copies available
    }
  }

  return inventory;
}

async function main(): Promise<void> {
  console.log('Reading sampled decks...');

  const files = readdirSync(SAMPLED_DIR).filter((f) => f.endsWith('.json'));
  if (files.length === 0) {
    console.error('No sampled deck files found. Run sample-decks.ts first.');
    process.exit(1);
  }

  console.log(`Found ${files.length} sampled decks.`);
  mkdirSync(OUT_DIR, { recursive: true });

  const candidates: ICandidate[] = [];
  let rowNumber = 1;

  for (const file of files) {
    if (candidates.length >= TARGET_CANDIDATES) break;

    const deck: IRawDeck = JSON.parse(
      readFileSync(join(SAMPLED_DIR, file), 'utf8'),
    );

    console.log(`\nProcessing: ${deck.name} (${deck.hero.name})`);

    const heroCard = catalog.indices.byIdentifier.get(deck.hero.cardIdentifier);
    const { owned, missing } = depleteInventory(deck.deckCards, 0.2);
    const syntheticInventory = buildSyntheticInventory(owned, heroCard);

    console.log(`  Owned: ${owned.size} unique cards, Missing: ${missing.length} unique cards`);

    for (const missingCard of missing) {
      if (candidates.length >= TARGET_CANDIDATES) break;

      const catalogCard = catalog.indices.byIdentifier.get(missingCard.cardIdentifier);
      if (!catalogCard) {
        console.log(`  Skipping unknown card: ${missingCard.cardIdentifier}`);
        continue;
      }

      // Tier 1 only. This script generates candidates for human gold-set
      // labeling and must not mix tier 2 fallbacks into the candidate pool,
      // since the labels would conflate distinct confidence levels.
      const match = findTierMatch(
        catalogCard,
        syntheticInventory,
        catalog,
        TIER_1_CONFIG,
      );

      if (match) {
        candidates.push({
          rowNumber,
          deckHero: deck.hero.name,
          deckName: deck.name,
          originalCard: catalogCard.cardIdentifier,
          originalCardName: catalogCard.name,
          proposedSubstitute: match.substitute.cardIdentifier,
          proposedSubstituteName: match.substitute.name,
          engineTier: match.tier,
          engineScore: match.score,
          rationale: match.rationale,
        });
        console.log(
          `  [${rowNumber}] ${catalogCard.name} -> ${match.substitute.name} (score: ${match.score.toFixed(2)})`,
        );
        rowNumber++;
      }
    }
  }

  if (candidates.length < TARGET_CANDIDATES) {
    console.log(
      `\nWARNING: Only found ${candidates.length}/${TARGET_CANDIDATES} candidates. ` +
        'Consider adding more decks or increasing the depletion rate.',
    );
  }

  const outPath = join(OUT_DIR, 'candidates.json');
  writeFileSync(outPath, JSON.stringify(candidates, null, 2));
  console.log(`\nWrote ${candidates.length} candidates to ${outPath}`);
}

void main();
