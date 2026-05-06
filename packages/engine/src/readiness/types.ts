import { ISubstitutionMatch, IPitchCurve } from '../substitution/types';

/**
 * Path classification for a readiness result.
 *
 * - **A**: 100% exact coverage, no substitutions.
 * - **B**: all missing cards covered by substitutions (effective = 100%).
 * - **C**: some cards remain missing even after substitution attempts.
 */
export type TPath = 'A' | 'B' | 'C';

export interface IBreakdownEntry {
  readonly cardIdentifier: string;
  /**
   * Human-readable card name from the catalog. Falls back to the identifier
   * when the card is not in the catalog (defensive; same fallback contract
   * as `type`). UI surfaces should render `name` instead of `cardIdentifier`.
   */
  readonly name: string;
  readonly quantity: number;
  readonly slot: string;
  /**
   * Card pitch (1 = red, 2 = yellow, 3 = blue).
   * null for pitch-less cards such as heroes, weapons, and equipment.
   * Populated from catalog at compute time (U11).
   */
  readonly pitch: 1 | 2 | 3 | null;
  /**
   * Card cost in resources.
   * null for pitch-less cards (heroes, weapons, equipment) that have no cost.
   * Populated from catalog at compute time (U11).
   */
  readonly cost: number | null;
  /**
   * Primary card type (types[0] from catalog).
   * 'unknown' when the card is not found in the catalog (defensive fallback).
   * Used by CardArt for the type glyph (R47).
   */
  readonly type: string;
  /**
   * Public URLs for the card face image (WebP), small + large. `null`
   * when the source catalog entry has no image code. Frontend treats
   * load failure as best-effort fallback to the stylized <CardArt> SVG
   * placeholder. See `ICatalogCard.imageUrl` for the full contract.
   */
  readonly imageUrl:
    | {
        readonly small: string;
        readonly large: string;
        readonly sources: readonly { readonly small: string; readonly large: string }[];
      }
    | null;
}

export interface ISubstitutedEntry {
  readonly original: IBreakdownEntry;
  readonly match: ISubstitutionMatch;
}

export interface IReadinessBreakdown {
  readonly exact: readonly IBreakdownEntry[];
  readonly substituted: readonly ISubstitutedEntry[];
  readonly missing: readonly IBreakdownEntry[];
  /**
   * All cards the user does not fully own: the union of `missing` entries
   * and the `original` side of `substituted` entries. Substitutions are
   * suggestions — this list is the source of truth for ownership gaps.
   *
   * Entries are grouped by (cardIdentifier, slot) with quantities summed
   * so that a card partially missing and partially substituted appears as
   * a single entry with the total not-owned quantity.
   */
  readonly notOwned: readonly IBreakdownEntry[];
}

export interface IEffectiveReadinessResult {
  readonly rawPercent: number;
  readonly effectivePercent: number;
  readonly path: TPath;
  /**
   * Tier-weighted fidelity percentage (0-100) for Path C display.
   *
   * Computed via `computeFidelity`:
   *   ((exactCount * 1.0) + Σ(tierWeight(sub.tier) * sub.quantity)) / totalCards * 100
   * where tierWeight(1) = 0.9 and tierWeight(2) = 0.7.
   *
   * Always populated (including Path A = 100 and Path B >= weighted total),
   * but primarily consumed by Path C surfaces. Not pre-rounded.
   */
  readonly fidelityPercent: number;
  readonly breakdown: IReadinessBreakdown;
  readonly substitutions: readonly ISubstitutionMatch[];
  readonly pitchCurve: {
    readonly original: IPitchCurve;
    readonly modified: IPitchCurve;
  };
}
