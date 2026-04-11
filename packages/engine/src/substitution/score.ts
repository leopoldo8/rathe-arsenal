import { ICatalog, ICatalogCard } from '../catalog/types';
import { ISubstitutionMatch, ITierConfig } from './types';
import {
  BASE_SCORE,
  DEFENSE_DELTA_WEIGHT,
  POWER_DELTA_WEIGHT,
} from './constants';
import { composeRationale } from './rationale';

function hasClassIntersection(a: readonly string[], b: readonly string[]): boolean {
  const setB = new Set(b);
  return a.some((cls) => setB.has(cls));
}

function hasTalentIntersection(a: readonly string[], b: readonly string[]): boolean {
  const setB = new Set(b);
  return a.some((t) => setB.has(t));
}

function hasTypeIntersection(a: readonly string[], b: readonly string[]): boolean {
  const setB = new Set(b);
  return a.some((t) => setB.has(t));
}

function keywordOverlapCount(a: readonly string[], b: readonly string[]): number {
  const setB = new Set(b);
  return a.filter((kw) => setB.has(kw)).length;
}

/** Equipment slot subtypes that define which body slot the equipment occupies. */
const EQUIPMENT_SLOTS = new Set(['Arms', 'Chest', 'Head', 'Legs']);

function getEquipmentSlot(card: ICatalogCard): string | null {
  for (const st of card.subtypes) {
    if (EQUIPMENT_SLOTS.has(st)) return st;
  }
  return null;
}

/**
 * Score a single candidate against a missing card using the given tier config.
 *
 * Hard constraints shared by all tiers:
 *  - same pitch
 *  - class intersection
 *  - type intersection
 *  - talent intersection (when missing has talents)
 *  - equipment body slot match (when missing is equipment)
 *  - power/defense delta within the tier's per-tier cap
 *
 * Tier-parameterized behavior:
 *  - `requireKeywordOverlap`: when true, zero overlap on a missing card that
 *    has keywords is a hard rejection (tier 1). When false, zero overlap is
 *    a soft penalty (tier 2).
 *  - `maxPowerDelta` / `maxDefenseDelta`: per-tier caps for stat differences.
 *
 * Returns the numeric score when the candidate passes all hard gates, or
 * `null` when any hard constraint rejects the candidate. The caller is
 * responsible for checking the returned score against `config.floorScore`.
 */
export function scoreCandidate(
  missing: ICatalogCard,
  candidate: ICatalogCard,
  config: ITierConfig,
): number | null {
  // Hard constraints shared by all tiers
  if (candidate.pitch !== missing.pitch) return null;
  if (!hasClassIntersection(missing.classes, candidate.classes)) return null;
  if (
    missing.talents.length > 0 &&
    !hasTalentIntersection(missing.talents, candidate.talents)
  ) {
    return null;
  }
  if (!hasTypeIntersection(missing.types, candidate.types)) return null;

  // Equipment slot constraint: Arms can only replace Arms, Chest only Chest, etc.
  const missingSlot = getEquipmentSlot(missing);
  if (missingSlot !== null) {
    const candidateSlot = getEquipmentSlot(candidate);
    if (candidateSlot !== missingSlot) return null;
  }

  let score = BASE_SCORE;

  // Keyword scoring.
  //
  // Zero-keyword scoring fix: when the missing card has no keywords, we
  // cannot be penalized for a missing overlap. The original tier 1 code
  // computed `(1 - 0/1) * 0.35 = 0.35` and dropped a perfect structural
  // match to 0.65 (below the 0.90 tier 1 floor), making FaB's numerous
  // keywordless action cards ineligible for substitution. The fix gates
  // the penalty on `missing.keywords.length > 0`.
  if (missing.keywords.length > 0) {
    const overlap = keywordOverlapCount(missing.keywords, candidate.keywords);

    if (overlap === 0 && config.requireKeywordOverlap) {
      return null; // tier 1 hard gate
    }

    const keywordScore = overlap / missing.keywords.length;
    score -= (1 - keywordScore) * config.keywordPenaltyWeight;
  }
  // When missing.keywords.length === 0, keyword score is implicitly 1.0
  // (no penalty) regardless of what the candidate carries.

  // Power delta
  const missingPower = missing.power ?? 0;
  const candidatePower = candidate.power ?? 0;
  const powerDelta = Math.abs(candidatePower - missingPower);

  if (powerDelta > config.maxPowerDelta) return null;
  score -= powerDelta * POWER_DELTA_WEIGHT;

  // Defense delta
  const missingDefense = missing.defense ?? 0;
  const candidateDefense = candidate.defense ?? 0;
  const defenseDelta = Math.abs(candidateDefense - missingDefense);

  if (defenseDelta > config.maxDefenseDelta) return null;
  score -= defenseDelta * DEFENSE_DELTA_WEIGHT;

  return score;
}

/**
 * Find the best substitution for a missing card at a single tier level.
 *
 * Iterates the candidates in the catalog that share a class and pitch with
 * the missing card, filters to those present in `remainingInventory`, and
 * returns the highest-scoring candidate whose score clears the tier floor.
 *
 * Candidates whose identifiers are in `excludedIdentifiers` are skipped —
 * this is the hook the interactive swap editor (Unit 7) uses to honor
 * persisted rejections during re-solve.
 *
 * Returns `null` when no candidate at this tier meets the floor.
 */
export function findTierMatch(
  missingCard: ICatalogCard,
  remainingInventory: ReadonlyMap<string, number>,
  catalog: ICatalog,
  config: ITierConfig,
  excludedIdentifiers: ReadonlySet<string> = new Set(),
): ISubstitutionMatch | null {
  const candidates = new Set<ICatalogCard>();

  // Gather candidates via byClassAndPitch using each class of the missing card.
  for (const cls of missingCard.classes) {
    const key = `${cls}:${missingCard.pitch}`;
    const indexed = catalog.indices.byClassAndPitch.get(key);
    if (indexed) {
      for (const card of indexed) {
        candidates.add(card);
      }
    }
  }

  let bestMatch: ISubstitutionMatch | null = null;
  let bestScore = -1;

  for (const candidate of candidates) {
    // Skip self
    if (candidate.cardIdentifier === missingCard.cardIdentifier) continue;

    // Skip rejected candidates (Unit 7: persisted rejections).
    if (excludedIdentifiers.has(candidate.cardIdentifier)) continue;

    // Must be in inventory
    const owned = remainingInventory.get(candidate.cardIdentifier) ?? 0;
    if (owned <= 0) continue;

    const score = scoreCandidate(missingCard, candidate, config);
    if (score === null) continue;
    if (score < config.floorScore) continue;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = Object.freeze({
        substitute: candidate,
        tier: config.tier,
        score,
        rationale: composeRationale(missingCard, candidate, config.tier),
      });
    }
  }

  return bestMatch;
}
