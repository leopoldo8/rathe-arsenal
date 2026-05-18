/**
 * computeDeckLegality — 7-step sequential verdict logic.
 *
 * Pure function: no async, no side effects, deterministic output.
 * Imports only from the engine catalog (no framework imports).
 *
 * 7-step order (from origin R24, Key Technical Decisions):
 *   1. Hero requirement (null → R24a message; wrong young/non-young → illegal)
 *   2. Card-pool total (> maxCardPool → illegal)
 *   3. Mainboard size vs format (under minimum or != exact → incomplete)
 *   4. Copy limits (>maxCopies or legendary >1 → illegal, names the card)
 *   5. Per-card legality (legalFormats / bannedFormats / legalHeroes / legalOverrides /
 *      specializations check — illegal, names the card)
 *   6. Silver Age rarity whitelist (non-allowed rarity → illegal)
 *   7. Final → 'legal'
 */

import type { ICatalog } from '../catalog/types';
import { Keyword } from '../catalog/types';
import type { TSupportedFormat, ILegalityDeck, IDeckLegalityResult } from './types';
import { FORMAT_RULES } from './rules';

/**
 * Compute the legality verdict for a deck in a given format.
 *
 * @param deck     - The deck to evaluate. `heroIdentifier` null → instant `illegal`.
 * @param catalog  - The card catalog singleton (used for card lookups).
 * @param format   - The format to evaluate against (one of the 4 supported formats).
 *
 * @returns `IDeckLegalityResult` with `category` and human-readable `reasons`.
 */
export function computeDeckLegality(
  deck: ILegalityDeck,
  catalog: ICatalog,
  format: TSupportedFormat,
): IDeckLegalityResult {
  const rules = FORMAT_RULES[format];

  // ─────────────────────────────────────────────────────────────────────────
  // Step 1: Hero requirement
  // ─────────────────────────────────────────────────────────────────────────

  if (deck.heroIdentifier === null) {
    return illegal('Hero not recognized — please re-select in Edit mode');
  }

  // Look up the hero card. If it does not exist in the catalog the deck is
  // effectively heroless — treat as the same R24a condition.
  let heroCard: ReturnType<ICatalog['indices']['byIdentifier']['get']>;
  try {
    heroCard = catalog.getCard(deck.heroIdentifier);
  } catch {
    return illegal('Hero not recognized — please re-select in Edit mode');
  }

  // Hero must be legal in the target format.
  const heroLegalInFormat = (heroCard.legalFormats as readonly string[]).includes(format);
  if (!heroLegalInFormat) {
    return illegal(
      `Hero "${heroCard.name}" is not legal in ${format}. Choose a different hero or format.`,
    );
  }

  // Young hero requirement.
  if (rules.requiresYoungHero && !heroCard.young) {
    return illegal(
      `${format} requires a young hero, but "${heroCard.name}" is not a young hero.`,
    );
  }
  if (!rules.requiresYoungHero && heroCard.young) {
    return illegal(
      `${format} requires a non-young hero, but "${heroCard.name}" is a young hero version. ` +
        `Use the adult version for this format.`,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 2: Card-pool total
  // ─────────────────────────────────────────────────────────────────────────

  const mainboardCards = deck.cards.filter((c) => c.slot === 'mainboard');
  const mainboardTotal = mainboardCards.reduce((sum, c) => sum + c.quantity, 0);

  const allCardsTotal = deck.cards.reduce((sum, c) => sum + c.quantity, 0);

  if (allCardsTotal > rules.maxCardPool) {
    return illegal(
      `Deck has ${allCardsTotal} cards but ${format} allows a maximum of ${rules.maxCardPool}.`,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 3: Mainboard size vs format (incomplete branch)
  // ─────────────────────────────────────────────────────────────────────────

  if (rules.exactMainboard !== null) {
    // Blitz / Silver Age require an exact count.
    if (mainboardTotal !== rules.exactMainboard) {
      return incomplete(
        `Deck has ${mainboardTotal} mainboard cards but ${format} requires exactly ${rules.exactMainboard}.`,
      );
    }
  } else {
    // CC / LL require at least minMainboard.
    if (mainboardTotal < rules.minMainboard) {
      return incomplete(
        `Deck has ${mainboardTotal} mainboard cards but ${format} requires at least ${rules.minMainboard}.`,
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 4: Copy limits
  // ─────────────────────────────────────────────────────────────────────────

  for (const deckCard of mainboardCards) {
    const card = catalog.indices.byIdentifier.get(deckCard.cardIdentifier);
    if (!card) continue; // Unknown cards are caught in step 5.

    const isLegendary = (card.keywords as readonly string[]).includes(Keyword.Legendary);
    const maxAllowed = isLegendary ? 1 : rules.maxCopies;

    if (deckCard.quantity > maxAllowed) {
      const label = isLegendary ? 'Legendary' : '';
      return illegal(
        `${label ? label + ' card' : 'Card'} "${card.name}" has ${deckCard.quantity} copies but ${format} allows at most ${maxAllowed}.`.trimStart(),
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 5: Per-card legality
  // ─────────────────────────────────────────────────────────────────────────

  // The `hero` field on a Hero-type card is the Hero enum value (e.g. "Dorinthea"),
  // which is what legalHeroes, legalOverrides.heroes, and specializations contain.
  const heroHeroEnum: string | undefined = heroCard.hero as string | undefined;

  for (const deckCard of mainboardCards) {
    const card = catalog.indices.byIdentifier.get(deckCard.cardIdentifier);

    if (!card) {
      return illegal(
        `Card "${deckCard.cardIdentifier}" is not recognized in the card catalog.`,
      );
    }

    // Check if the format is explicitly banned for this card.
    if (card.bannedFormats && (card.bannedFormats as readonly string[]).includes(format)) {
      return illegal(`"${card.name}" is banned in ${format}.`);
    }

    // Check that the card is legal in the format at all.
    const cardLegalInFormat = (card.legalFormats as readonly string[]).includes(format);
    if (!cardLegalInFormat) {
      return illegal(`"${card.name}" is not legal in ${format}.`);
    }

    // Check hero scope.
    // A card with an empty legalHeroes array is usable by all heroes.
    // When legalHeroes is non-empty, the deck's hero must appear in it
    // OR the card must have a matching legalOverride OR a matching specialization.
    if (card.legalHeroes.length > 0 && heroHeroEnum !== undefined) {
      const heroAllowed = (card.legalHeroes as readonly string[]).includes(heroHeroEnum);

      // legalOverrides — per-format additional hero scope.
      const overrideAllowed =
        card.legalOverrides != null &&
        card.legalOverrides.some(
          (o) => o.format === format && (o.heroes as readonly string[]).includes(heroHeroEnum),
        );

      // specializations — the card has Keyword.Specialization; only the named hero(es) can run it.
      const specializationAllowed =
        card.specializations != null &&
        (card.specializations as readonly string[]).includes(heroHeroEnum);

      if (!heroAllowed && !overrideAllowed && !specializationAllowed) {
        return illegal(`"${card.name}" is not legal with hero "${heroCard.name}".`);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 6: Silver Age rarity whitelist
  // ─────────────────────────────────────────────────────────────────────────

  if (rules.allowedRarities !== null) {
    for (const deckCard of mainboardCards) {
      const card = catalog.indices.byIdentifier.get(deckCard.cardIdentifier);
      if (!card) continue; // Already caught above.

      if (!rules.allowedRarities.has(card.rarity as string)) {
        return illegal(
          `"${card.name}" (${card.rarity}) is not allowed in ${format}, which only permits ${[...rules.allowedRarities].filter((r) => r !== 'Token').join(', ')}.`,
        );
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 7: Legal
  // ─────────────────────────────────────────────────────────────────────────

  return Object.freeze({ category: 'legal', reasons: Object.freeze([]) });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function illegal(reason: string): IDeckLegalityResult {
  return Object.freeze({ category: 'illegal', reasons: Object.freeze([reason]) });
}

function incomplete(reason: string): IDeckLegalityResult {
  return Object.freeze({ category: 'incomplete', reasons: Object.freeze([reason]) });
}
