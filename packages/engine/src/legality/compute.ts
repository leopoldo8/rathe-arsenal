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
import type { TSupportedFormat, ILegalityDeck, IDeckLegalityResult, TLegalityReasonDetail } from './types';
import { FORMAT_RULES } from './rules';
import { findCardRarityViolation, findCardScopeViolation, getCopyLimit } from './card-legality';

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

  const heroUnrecognized: TLegalityReasonDetail = { code: 'hero_unrecognized', params: {} };
  if (deck.heroIdentifier === null) {
    return illegal('Hero not recognized — please re-select in Edit mode', heroUnrecognized);
  }

  // Look up the hero card. If it does not exist in the catalog the deck is
  // effectively heroless — treat as the same R24a condition.
  let heroCard: ReturnType<ICatalog['indices']['byIdentifier']['get']>;
  try {
    heroCard = catalog.getCard(deck.heroIdentifier);
  } catch {
    return illegal('Hero not recognized — please re-select in Edit mode', heroUnrecognized);
  }

  // Hero must be legal in the target format.
  const heroLegalInFormat = (heroCard.legalFormats as readonly string[]).includes(format);
  if (!heroLegalInFormat) {
    return illegal(
      `Hero "${heroCard.name}" is not legal in ${format}. Choose a different hero or format.`,
      { code: 'hero_not_legal', params: { hero: heroCard.name, format } },
    );
  }

  // Young hero requirement.
  if (rules.requiresYoungHero && !heroCard.young) {
    return illegal(
      `${format} requires a young hero, but "${heroCard.name}" is not a young hero.`,
      { code: 'young_hero_required', params: { hero: heroCard.name, format } },
    );
  }
  if (!rules.requiresYoungHero && heroCard.young) {
    return illegal(
      `${format} requires a non-young hero, but "${heroCard.name}" is a young hero version. ` +
        `Use the adult version for this format.`,
      { code: 'adult_hero_required', params: { hero: heroCard.name, format } },
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
      { code: 'card_pool_too_large', params: { total: allCardsTotal, max: rules.maxCardPool, format } },
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
        { code: 'mainboard_not_exact', params: { total: mainboardTotal, required: rules.exactMainboard, format } },
      );
    }
  } else {
    // CC / LL require at least minMainboard.
    if (mainboardTotal < rules.minMainboard) {
      return incomplete(
        `Deck has ${mainboardTotal} mainboard cards but ${format} requires at least ${rules.minMainboard}.`,
        { code: 'mainboard_too_small', params: { total: mainboardTotal, required: rules.minMainboard, format } },
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 4: Copy limits
  // ─────────────────────────────────────────────────────────────────────────

  for (const deckCard of mainboardCards) {
    const card = catalog.indices.byIdentifier.get(deckCard.cardIdentifier);
    if (!card) continue; // Unknown cards are caught in step 5.

    const maxAllowed = getCopyLimit(card, format);
    const isLegendary = (card.keywords as readonly string[]).includes(Keyword.Legendary);

    if (deckCard.quantity > maxAllowed) {
      const label = isLegendary ? 'Legendary' : '';
      return illegal(
        `${label ? label + ' card' : 'Card'} "${card.name}" has ${deckCard.quantity} copies but ${format} allows at most ${maxAllowed}.`.trimStart(),
        {
          code: 'too_many_copies',
          params: { card: card.name, count: deckCard.quantity, max: maxAllowed, format, legendary: isLegendary },
        },
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 5: Per-card legality
  // ─────────────────────────────────────────────────────────────────────────

  for (const deckCard of mainboardCards) {
    const card = catalog.indices.byIdentifier.get(deckCard.cardIdentifier);

    if (!card) {
      return illegal(
        `Card "${deckCard.cardIdentifier}" is not recognized in the card catalog.`,
        { code: 'card_unknown', params: { card: deckCard.cardIdentifier } },
      );
    }

    const violation = findCardScopeViolation(card, heroCard, format);
    if (violation) return illegal(violation.reason, violation.detail);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 6: Silver Age rarity whitelist
  // ─────────────────────────────────────────────────────────────────────────

  for (const deckCard of mainboardCards) {
    const card = catalog.indices.byIdentifier.get(deckCard.cardIdentifier);
    if (!card) continue; // Already caught above.

    const violation = findCardRarityViolation(card, format);
    if (violation) return illegal(violation.reason, violation.detail);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 7: Legal
  // ─────────────────────────────────────────────────────────────────────────

  return Object.freeze({ category: 'legal', reasons: Object.freeze([]), details: Object.freeze([]) });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function illegal(reason: string, detail: TLegalityReasonDetail): IDeckLegalityResult {
  return Object.freeze({ category: 'illegal', reasons: Object.freeze([reason]), details: Object.freeze([detail]) });
}

function incomplete(reason: string, detail: TLegalityReasonDetail): IDeckLegalityResult {
  return Object.freeze({ category: 'incomplete', reasons: Object.freeze([reason]), details: Object.freeze([detail]) });
}
