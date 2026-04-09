import { ICatalog } from '../catalog/types';
import { ISubstitutionMatch, IPitchTolerance } from '../substitution/types';
import { DEFAULT_PITCH_TOLERANCE } from '../substitution/constants';
import { computePitchCurve, computePitchDelta, isWithinTolerance } from '../substitution/pitch-curve';
import { tier1Substitution } from '../substitution/tier1';
import {
  IBreakdownEntry,
  IEffectiveReadinessResult,
  IReadinessBreakdown,
  ISubstitutedEntry,
} from './types';

/** Slots that are never eligible for substitution (R20 rule). */
const NON_SUBSTITUTABLE_SLOTS = new Set(['hero', 'weapon']);

interface IDeckCard {
  readonly cardIdentifier: string;
  readonly quantity: number;
  readonly slot: string;
}

interface IDeck {
  readonly cards: readonly IDeckCard[];
}

/**
 * Compute effective readiness for a deck against a user's inventory.
 * Pure function -- no side effects, no async, deterministic.
 */
export function computeEffectiveReadiness(
  deck: IDeck,
  inventory: ReadonlyMap<string, number>,
  catalog: ICatalog,
  tolerance: IPitchTolerance = DEFAULT_PITCH_TOLERANCE,
): IEffectiveReadinessResult {
  // Mutable working copy of inventory quantities
  const remainingInventory = new Map<string, number>();
  for (const [id, qty] of inventory) {
    remainingInventory.set(id, qty);
  }

  const exact: IBreakdownEntry[] = [];
  const substituted: ISubstitutedEntry[] = [];
  const missing: IBreakdownEntry[] = [];
  const substitutions: ISubstitutionMatch[] = [];

  let totalCards = 0;
  let exactCount = 0;
  let substitutedCount = 0;

  // Build original pitch curve entries from the deck
  const originalPitchEntries: Array<{ pitch: number | null; quantity: number }> = [];

  // Build modified pitch curve entries (starts same, substitutions may change it)
  const modifiedPitchEntries: Array<{ pitch: number | null; quantity: number }> = [];

  for (const deckCard of deck.cards) {
    totalCards += deckCard.quantity;

    const available = remainingInventory.get(deckCard.cardIdentifier) ?? 0;
    const catalogCard = catalog.indices.byIdentifier.get(deckCard.cardIdentifier);
    const cardPitch = catalogCard?.pitch ?? null;

    // Track original pitch
    originalPitchEntries.push({ pitch: cardPitch, quantity: deckCard.quantity });

    if (available >= deckCard.quantity) {
      // Exact match -- all copies available
      exact.push(Object.freeze({
        cardIdentifier: deckCard.cardIdentifier,
        quantity: deckCard.quantity,
        slot: deckCard.slot,
      }));
      remainingInventory.set(deckCard.cardIdentifier, available - deckCard.quantity);
      exactCount += deckCard.quantity;
      modifiedPitchEntries.push({ pitch: cardPitch, quantity: deckCard.quantity });
    } else {
      // Some or all copies missing
      const exactQty = available;
      const missingQty = deckCard.quantity - available;

      if (exactQty > 0) {
        exact.push(Object.freeze({
          cardIdentifier: deckCard.cardIdentifier,
          quantity: exactQty,
          slot: deckCard.slot,
        }));
        remainingInventory.set(deckCard.cardIdentifier, 0);
        exactCount += exactQty;
        modifiedPitchEntries.push({ pitch: cardPitch, quantity: exactQty });
      }

      // Non-substitutable slots go straight to missing
      if (NON_SUBSTITUTABLE_SLOTS.has(deckCard.slot)) {
        missing.push(Object.freeze({
          cardIdentifier: deckCard.cardIdentifier,
          quantity: missingQty,
          slot: deckCard.slot,
        }));
        modifiedPitchEntries.push({ pitch: cardPitch, quantity: missingQty });
        continue;
      }

      // Try to substitute each missing copy
      if (!catalogCard) {
        missing.push(Object.freeze({
          cardIdentifier: deckCard.cardIdentifier,
          quantity: missingQty,
          slot: deckCard.slot,
        }));
        modifiedPitchEntries.push({ pitch: cardPitch, quantity: missingQty });
        continue;
      }

      let remainingMissing = missingQty;

      for (let i = 0; i < missingQty; i++) {
        const match = tier1Substitution(catalogCard, remainingInventory, catalog, tolerance);

        if (match) {
          // Validate pitch curve tolerance with this substitution
          const tentativeModified = [
            ...modifiedPitchEntries,
            { pitch: match.substitute.pitch, quantity: 1 },
          ];
          const tentativeOriginal = computePitchCurve(originalPitchEntries);
          const tentativeModifiedCurve = computePitchCurve(tentativeModified);
          const delta = computePitchDelta(tentativeOriginal, tentativeModifiedCurve);

          if (isWithinTolerance(delta, tolerance)) {
            const originalEntry: IBreakdownEntry = Object.freeze({
              cardIdentifier: deckCard.cardIdentifier,
              quantity: 1,
              slot: deckCard.slot,
            });

            substituted.push(Object.freeze({ original: originalEntry, match }));
            substitutions.push(match);
            substitutedCount += 1;
            remainingMissing -= 1;

            // Consume from inventory
            const subAvailable = remainingInventory.get(match.substitute.cardIdentifier) ?? 0;
            remainingInventory.set(match.substitute.cardIdentifier, subAvailable - 1);

            modifiedPitchEntries.push({ pitch: match.substitute.pitch, quantity: 1 });
          } else {
            // Pitch curve would break -- reject this substitution
            modifiedPitchEntries.push({ pitch: cardPitch, quantity: 1 });
          }
        } else {
          modifiedPitchEntries.push({ pitch: cardPitch, quantity: 1 });
        }
      }

      if (remainingMissing > 0) {
        missing.push(Object.freeze({
          cardIdentifier: deckCard.cardIdentifier,
          quantity: remainingMissing,
          slot: deckCard.slot,
        }));
      }
    }
  }

  const rawPercent = totalCards > 0 ? Math.round((exactCount / totalCards) * 1000) / 10 : 0;
  const effectivePercent = totalCards > 0 ? Math.round(((exactCount + substitutedCount) / totalCards) * 1000) / 10 : 0;

  const originalCurve = computePitchCurve(originalPitchEntries);
  const modifiedCurve = computePitchCurve(modifiedPitchEntries);

  const breakdown: IReadinessBreakdown = Object.freeze({
    exact: Object.freeze(exact),
    substituted: Object.freeze(substituted),
    missing: Object.freeze(missing),
  });

  return Object.freeze({
    rawPercent,
    effectivePercent,
    breakdown,
    substitutions: Object.freeze(substitutions),
    pitchCurve: Object.freeze({
      original: originalCurve,
      modified: modifiedCurve,
    }),
  });
}
