import { ICatalog } from '../catalog/types';
import { ISubstitutionMatch, IPitchTolerance } from '../substitution/types';
import { DEFAULT_PITCH_TOLERANCE } from '../substitution/constants';
import { computePitchCurve, computePitchDelta, isWithinTolerance } from '../substitution/pitch-curve';
import { findSubstitution } from '../substitution/find-substitution';
import {
  IBreakdownEntry,
  IEffectiveReadinessResult,
  IMissingCopies,
  IReadinessBreakdown,
  ISubstitutedEntry,
} from './types';
import { computePath } from './compute-path';
import { computeFidelity } from './compute-fidelity';
import { buildProtectedKey } from './protected-key';

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
  /** Copies carried outside the starting deck; needed like the deck copies, and told apart in the entries. */
  readonly inventoryQuantity?: number;
  readonly slot: string;
}

/** The field an entry carries for its inventory copies, only when there are some. */
function inventoryPart(copies: number): { readonly inventoryQuantity?: number } {
  return copies > 0 ? { inventoryQuantity: copies } : {};
}

/** The two entries of one card and slot as one: copies and their inventory part add up. */
function mergeEntries(first: IBreakdownEntry, second: IBreakdownEntry): IBreakdownEntry {
  return {
    ...first,
    quantity: first.quantity + second.quantity,
    ...inventoryPart((first.inventoryQuantity ?? 0) + (second.inventoryQuantity ?? 0)),
  };
}

function countMissingCopies(notOwned: readonly IBreakdownEntry[]): IMissingCopies {
  const total = notOwned.reduce((sum, entry) => sum + entry.quantity, 0);
  const inventory = notOwned.reduce((sum, entry) => sum + (entry.inventoryQuantity ?? 0), 0);
  return { total, deck: total - inventory, inventory };
}

interface IDeck {
  readonly cards: readonly IDeckCard[];
}

/**
 * Compute effective readiness for a deck against a user's inventory.
 * Pure function -- no side effects, no async, deterministic.
 *
 * `effectivePercent` counts exact copies only: `breakdown.substituted[]`
 * entries are suggestions and count toward nothing until used (AD-012).
 *
 * The optional `protectedCopies` map (keyed by `buildProtectedKey`) holds, per
 * (card, slot), how many of the copies not covered exactly must never get a
 * stand-in: they go straight to `missing`. It is how a replacement the owner
 * picked stays in the deck as a card to acquire. Omitting it, or passing an
 * empty map, preserves today's behavior.
 */
export function computeEffectiveReadiness(
  deck: IDeck,
  inventory: ReadonlyMap<string, number>,
  catalog: ICatalog,
  tolerance: IPitchTolerance = DEFAULT_PITCH_TOLERANCE,
  protectedCopies: ReadonlyMap<string, number> = new Map(),
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
    /** Of `missingQty`, the copies that belong to the inventory. */
    readonly missingInventory: number;
  }

  const pass1Slots: IPass1Slot[] = [];

  for (const deckCard of deck.cards) {
    const inventoryNeed = deckCard.inventoryQuantity ?? 0;
    const needed = deckCard.quantity + inventoryNeed;
    totalCards += needed;

    const available = remainingInventory.get(deckCard.cardIdentifier) ?? 0;
    const catalogCard = catalog.indices.byIdentifier.get(deckCard.cardIdentifier);
    const cardPitch = catalogCard?.pitch ?? null;

    // Track original pitch.
    originalPitchEntries.push({ pitch: cardPitch, quantity: needed });

    // Derive enriched metadata for this card once per deck card.
    const entryMeta = deriveEntryMeta(catalogCard, deckCard.cardIdentifier);

    const exactQty = Math.min(available, needed);
    const missingQty = needed - exactQty;
    // Owned copies cover the deck copies first, so the inventory is what is left uncovered.
    const exactInventory = Math.max(0, exactQty - deckCard.quantity);
    const missingInventory = inventoryNeed - exactInventory;

    if (exactQty > 0) {
      exact.push(Object.freeze({
        cardIdentifier: deckCard.cardIdentifier,
        quantity: exactQty,
        ...inventoryPart(exactInventory),
        slot: deckCard.slot,
        ...entryMeta,
      }));
      remainingInventory.set(deckCard.cardIdentifier, available - exactQty);
      exactCount += exactQty;
      modifiedPitchEntries.push({ pitch: cardPitch, quantity: exactQty });
    }

    pass1Slots.push({ deckCard, catalogCard, cardPitch, entryMeta, exactQty, missingQty, missingInventory });
  }

  // ---------------------------------------------------------------------------
  // Pass 2 — substitution search.
  //
  // Only deck cards with remaining missing quantity reach this pass.
  // remainingInventory now reflects the fully-reserved exact-match allocation
  // from pass 1, so no card needed by its own slot can be offered here.
  // ---------------------------------------------------------------------------

  // Working copy: a (card, slot) split across several deck rows spends its
  // protected count row by row instead of protecting every row in full.
  const remainingProtected = new Map(protectedCopies);

  for (const slot of pass1Slots) {
    const { deckCard, catalogCard, cardPitch, entryMeta, missingQty, missingInventory } = slot;

    if (missingQty === 0) {
      // Fully covered by exact match in pass 1 — nothing left to substitute.
      continue;
    }

    // Non-substitutable slots go straight to missing.
    if (NON_SUBSTITUTABLE_SLOTS.has(deckCard.slot)) {
      missing.push(Object.freeze({
        cardIdentifier: deckCard.cardIdentifier,
        quantity: missingQty,
        ...inventoryPart(missingInventory),
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
        ...inventoryPart(missingInventory),
        slot: deckCard.slot,
        ...entryMeta,
      }));
      modifiedPitchEntries.push({ pitch: cardPitch, quantity: missingQty });
      continue;
    }

    let remainingMissing = missingQty;
    let remainingMissingInventory = missingInventory;

    const protectedKey = buildProtectedKey(deckCard.cardIdentifier, deckCard.slot);
    const protectedHere = Math.min(remainingProtected.get(protectedKey) ?? 0, missingQty);
    if (protectedHere > 0) {
      remainingProtected.set(protectedKey, (remainingProtected.get(protectedKey) ?? 0) - protectedHere);
    }

    // The deck copies come first among the missing ones, so the last copies are the inventory's.
    const firstInventoryCopy = missingQty - missingInventory;

    for (let i = 0; i < missingQty; i++) {
      if (i < protectedHere) {
        modifiedPitchEntries.push({ pitch: cardPitch, quantity: 1 });
        continue;
      }

      const match = findSubstitution(
        catalogCard,
        remainingInventory,
        catalog,
        deckCard.slot,
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
          const coversInventory = i >= firstInventoryCopy;
          const originalEntry: IBreakdownEntry = Object.freeze({
            cardIdentifier: deckCard.cardIdentifier,
            quantity: 1,
            ...inventoryPart(coversInventory ? 1 : 0),
            slot: deckCard.slot,
            ...entryMeta,
          });

          substituted.push(Object.freeze({ original: originalEntry, match }));
          substitutions.push(match);
          remainingMissing -= 1;
          if (coversInventory) remainingMissingInventory -= 1;

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
        ...inventoryPart(remainingMissingInventory),
        slot: deckCard.slot,
        ...entryMeta,
      }));
    }
  }

  const rawPercent = totalCards > 0 ? Math.round((exactCount / totalCards) * 1000) / 10 : 0;
  const effectivePercent = rawPercent;

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
      notOwnedMap.set(key, mergeEntries(existing, entry));
    } else {
      notOwnedMap.set(key, { ...entry });
    }
  }
  for (const entry of substituted) {
    const key = `${entry.original.cardIdentifier}::${entry.original.slot}`;
    const existing = notOwnedMap.get(key);
    if (existing) {
      notOwnedMap.set(key, mergeEntries(existing, entry.original));
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
    missingCopies: Object.freeze(countMissingCopies(notOwned)),
    substitutions: Object.freeze(substitutions),
    pitchCurve: Object.freeze({
      original: originalCurve,
      modified: modifiedCurve,
    }),
  });
}
