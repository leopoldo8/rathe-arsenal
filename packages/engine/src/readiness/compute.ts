import { ICatalog } from '../catalog/types';
import { ISubstitutionMatch, IPitchTolerance } from '../substitution/types';
import { DEFAULT_PITCH_TOLERANCE } from '../substitution/constants';
import { computePitchCurve, computePitchDelta, isWithinTolerance } from '../substitution/pitch-curve';
import { findSubstitution } from '../substitution/find-substitution';
import {
  IBreakdownEntry,
  IEffectiveReadinessResult,
  IReadinessBreakdown,
  ISubstitutedEntry,
} from './types';
import { computePath } from './compute-path';
import { computeFidelity } from './compute-fidelity';

/** Slots that are never eligible for substitution (R20 rule). */
const NON_SUBSTITUTABLE_SLOTS = new Set(['hero', 'weapon']);

/**
 * Derives the enriched pitch, cost, and type fields for a breakdown entry
 * from the catalog card. Defensively returns null/null/'unknown' when the
 * card is not found in the catalog so the compute function never throws.
 *
 * pitch is constrained to 1 | 2 | 3 per the FaB rules; any other numeric
 * value (which should not occur in practice) is cast to null for safety.
 */
type TImageUrlPair = {
  readonly small: string;
  readonly large: string;
  readonly sources: readonly { readonly small: string; readonly large: string }[];
};

function deriveEntryMeta(
  catalogCard:
    | {
        name: string;
        pitch: number | null;
        cost: number | null;
        types: readonly string[];
        imageUrl?: TImageUrlPair | null;
      }
    | undefined,
  fallbackIdentifier: string,
): {
  name: string;
  pitch: 1 | 2 | 3 | null;
  cost: number | null;
  type: string;
  imageUrl: TImageUrlPair | null;
} {
  if (!catalogCard) {
    return { name: fallbackIdentifier, pitch: null, cost: null, type: 'unknown', imageUrl: null };
  }
  const rawPitch = catalogCard.pitch;
  const pitch: 1 | 2 | 3 | null =
    rawPitch === 1 || rawPitch === 2 || rawPitch === 3 ? rawPitch : null;
  const cost = catalogCard.cost ?? null;
  const type = catalogCard.types[0] ?? 'unknown';
  const imageUrl = catalogCard.imageUrl ?? null;
  return { name: catalogCard.name, pitch, cost, type, imageUrl };
}

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
 *
 * The optional `excludedIdentifiers` set lets the interactive swap editor
 * (Unit 7) re-solve a deck while skipping substitutes the user has
 * explicitly rejected. Passing an empty set preserves Phase 0 behavior.
 */
export function computeEffectiveReadiness(
  deck: IDeck,
  inventory: ReadonlyMap<string, number>,
  catalog: ICatalog,
  tolerance: IPitchTolerance = DEFAULT_PITCH_TOLERANCE,
  excludedIdentifiers: ReadonlySet<string> = new Set(),
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

  // Build original pitch curve entries from the deck (same regardless of pass).
  const originalPitchEntries: Array<{ pitch: number | null; quantity: number }> = [];

  // Build modified pitch curve entries (starts same, substitutions may change it).
  const modifiedPitchEntries: Array<{ pitch: number | null; quantity: number }> = [];

  // ---------------------------------------------------------------------------
  // Pass 1 — exact-match reservation.
  //
  // Iterate all deck cards, emit exact/partial-exact entries, and decrement
  // remainingInventory for owned copies. Substitution is NOT attempted here.
  // This guarantees that every card needed by its own deck slot is reserved
  // before any substitution search looks at remainingInventory.
  // ---------------------------------------------------------------------------

  interface IPass1Slot {
    readonly deckCard: IDeckCard;
    readonly catalogCard: ReturnType<typeof catalog.indices.byIdentifier.get>;
    readonly cardPitch: number | null;
    readonly entryMeta: ReturnType<typeof deriveEntryMeta>;
    readonly exactQty: number;
    readonly missingQty: number;
  }

  const pass1Slots: IPass1Slot[] = [];

  for (const deckCard of deck.cards) {
    totalCards += deckCard.quantity;

    const available = remainingInventory.get(deckCard.cardIdentifier) ?? 0;
    const catalogCard = catalog.indices.byIdentifier.get(deckCard.cardIdentifier);
    const cardPitch = catalogCard?.pitch ?? null;

    // Track original pitch.
    originalPitchEntries.push({ pitch: cardPitch, quantity: deckCard.quantity });

    // Derive enriched metadata for this card once per deck card.
    const entryMeta = deriveEntryMeta(catalogCard, deckCard.cardIdentifier);

    const exactQty = Math.min(available, deckCard.quantity);
    const missingQty = deckCard.quantity - exactQty;

    if (exactQty > 0) {
      exact.push(Object.freeze({
        cardIdentifier: deckCard.cardIdentifier,
        quantity: exactQty,
        slot: deckCard.slot,
        ...entryMeta,
      }));
      remainingInventory.set(deckCard.cardIdentifier, available - exactQty);
      exactCount += exactQty;
      modifiedPitchEntries.push({ pitch: cardPitch, quantity: exactQty });
    }

    pass1Slots.push({ deckCard, catalogCard, cardPitch, entryMeta, exactQty, missingQty });
  }

  // ---------------------------------------------------------------------------
  // Pass 2 — substitution search.
  //
  // Only deck cards with remaining missing quantity reach this pass.
  // remainingInventory now reflects the fully-reserved exact-match allocation
  // from pass 1, so no card needed by its own slot can be offered here.
  // ---------------------------------------------------------------------------

  for (const slot of pass1Slots) {
    const { deckCard, catalogCard, cardPitch, entryMeta, missingQty } = slot;

    if (missingQty === 0) {
      // Fully covered by exact match in pass 1 — nothing left to substitute.
      continue;
    }

    // Non-substitutable slots go straight to missing.
    if (NON_SUBSTITUTABLE_SLOTS.has(deckCard.slot)) {
      missing.push(Object.freeze({
        cardIdentifier: deckCard.cardIdentifier,
        quantity: missingQty,
        slot: deckCard.slot,
        ...entryMeta,
      }));
      modifiedPitchEntries.push({ pitch: cardPitch, quantity: missingQty });
      continue;
    }

    // Cards absent from catalog cannot be substituted.
    if (!catalogCard) {
      missing.push(Object.freeze({
        cardIdentifier: deckCard.cardIdentifier,
        quantity: missingQty,
        slot: deckCard.slot,
        ...entryMeta,
      }));
      modifiedPitchEntries.push({ pitch: cardPitch, quantity: missingQty });
      continue;
    }

    let remainingMissing = missingQty;

    for (let i = 0; i < missingQty; i++) {
      const match = findSubstitution(
        catalogCard,
        remainingInventory,
        catalog,
        excludedIdentifiers,
      );

      if (match) {
        // Validate pitch curve tolerance with this substitution.
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
            ...entryMeta,
          });

          substituted.push(Object.freeze({ original: originalEntry, match }));
          substitutions.push(match);
          substitutedCount += 1;
          remainingMissing -= 1;

          // Consume from inventory.
          const subAvailable = remainingInventory.get(match.substitute.cardIdentifier) ?? 0;
          remainingInventory.set(match.substitute.cardIdentifier, subAvailable - 1);

          modifiedPitchEntries.push({ pitch: match.substitute.pitch, quantity: 1 });
        } else {
          // Pitch curve would break -- reject this substitution.
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
        ...entryMeta,
      }));
    }
  }

  const rawPercent = totalCards > 0 ? Math.round((exactCount / totalCards) * 1000) / 10 : 0;
  const effectivePercent = totalCards > 0 ? Math.round(((exactCount + substitutedCount) / totalCards) * 1000) / 10 : 0;

  const originalCurve = computePitchCurve(originalPitchEntries);
  const modifiedCurve = computePitchCurve(modifiedPitchEntries);

  // Compute notOwned: union of missing + substituted originals, grouped by
  // (cardIdentifier, slot) with quantities summed.
  // The enriched fields (pitch, cost, type) are preserved from the source entry.
  const notOwnedMap = new Map<string, IBreakdownEntry>();
  for (const entry of missing) {
    const key = `${entry.cardIdentifier}::${entry.slot}`;
    const existing = notOwnedMap.get(key);
    if (existing) {
      notOwnedMap.set(key, { ...existing, quantity: existing.quantity + entry.quantity });
    } else {
      notOwnedMap.set(key, { ...entry });
    }
  }
  for (const entry of substituted) {
    const key = `${entry.original.cardIdentifier}::${entry.original.slot}`;
    const existing = notOwnedMap.get(key);
    if (existing) {
      notOwnedMap.set(key, { ...existing, quantity: existing.quantity + entry.original.quantity });
    } else {
      notOwnedMap.set(key, { ...entry.original });
    }
  }
  const notOwned: IBreakdownEntry[] = Array.from(notOwnedMap.values()).map((e) => Object.freeze(e));

  const breakdown: IReadinessBreakdown = Object.freeze({
    exact: Object.freeze(exact),
    substituted: Object.freeze(substituted),
    missing: Object.freeze(missing),
    notOwned: Object.freeze(notOwned),
  });

  return Object.freeze({
    rawPercent,
    effectivePercent,
    path: computePath(breakdown),
    fidelityPercent: computeFidelity(breakdown, totalCards),
    breakdown,
    substitutions: Object.freeze(substitutions),
    pitchCurve: Object.freeze({
      original: originalCurve,
      modified: modifiedCurve,
    }),
  });
}
