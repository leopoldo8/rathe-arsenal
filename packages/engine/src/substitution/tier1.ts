import { ICatalog, ICatalogCard } from '../catalog/types';
import { ISubstitutionMatch, IPitchTolerance } from './types';
import {
  BASE_SCORE,
  DEFENSE_DELTA_WEIGHT,
  KEYWORD_OVERLAP_WEIGHT,
  POWER_DELTA_WEIGHT,
  TIER_1_FLOOR_SCORE,
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

function scoreCandidate(
  missing: ICatalogCard,
  candidate: ICatalogCard,
): number | null {
  // Hard constraints
  if (candidate.pitch !== missing.pitch) return null;
  if (!hasClassIntersection(missing.classes, candidate.classes)) return null;
  if (missing.talents.length > 0 && !hasTalentIntersection(missing.talents, candidate.talents)) return null;
  if (!hasTypeIntersection(missing.types, candidate.types)) return null;

  // Equipment slot constraint: Arms can only replace Arms, Chest only Chest, etc.
  const missingSlot = getEquipmentSlot(missing);
  if (missingSlot !== null) {
    const candidateSlot = getEquipmentSlot(candidate);
    if (candidateSlot !== missingSlot) return null;
  }

  let score = BASE_SCORE;

  // Keyword overlap scoring
  const overlap = keywordOverlapCount(missing.keywords, candidate.keywords);
  const maxKeywords = Math.max(missing.keywords.length, 1);
  const keywordScore = overlap / maxKeywords;

  if (overlap === 0 && missing.keywords.length > 0) {
    return null; // No keyword overlap when missing card has keywords -- skip for tier 1
  }

  score -= (1 - keywordScore) * KEYWORD_OVERLAP_WEIGHT;

  // Power delta
  const missingPower = missing.power ?? 0;
  const candidatePower = candidate.power ?? 0;
  const powerDelta = Math.abs(candidatePower - missingPower);

  if (powerDelta > 1) return null;
  score -= powerDelta * POWER_DELTA_WEIGHT;

  // Defense delta
  const missingDefense = missing.defense ?? 0;
  const candidateDefense = candidate.defense ?? 0;
  const defenseDelta = Math.abs(candidateDefense - missingDefense);

  if (defenseDelta > 1) return null;
  score -= defenseDelta * DEFENSE_DELTA_WEIGHT;

  return score;
}

/**
 * Find the best tier 1 substitution for a missing card from the remaining inventory.
 * Returns null if no candidate meets the tier 1 floor score.
 */
export function tier1Substitution(
  missingCard: ICatalogCard,
  remainingInventory: Map<string, number>,
  catalog: ICatalog,
  _tolerance: IPitchTolerance,
): ISubstitutionMatch | null {
  const candidates = new Set<ICatalogCard>();

  // Gather candidates from byClassAndPitch using each class of the missing card
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

    // Must be in inventory
    const owned = remainingInventory.get(candidate.cardIdentifier) ?? 0;
    if (owned <= 0) continue;

    const score = scoreCandidate(missingCard, candidate);
    if (score === null) continue;
    if (score < TIER_1_FLOOR_SCORE) continue;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = Object.freeze({
        substitute: candidate,
        tier: 1 as const,
        score,
        rationale: composeRationale(missingCard, candidate),
      });
    }
  }

  return bestMatch;
}
