import { ICatalogCard } from '../catalog/types';
import { TSubstitutionTier } from './types';

export type TRationalePitch = 'red' | 'yellow' | 'blue' | 'colorless';

/** The comparison facts behind a rationale, so clients can phrase it in their own locale. */
export interface IRationaleDetail {
  readonly tier: TSubstitutionTier;
  readonly pitch: TRationalePitch;
  readonly sharedClasses: readonly string[];
  readonly powerDelta: number;
  readonly defenseDelta: number;
  readonly sharedKeywords: readonly string[];
}

function pitchLabel(pitch: number | null): TRationalePitch {
  switch (pitch) {
    case 1: return 'red';
    case 2: return 'yellow';
    case 3: return 'blue';
    default: return 'colorless';
  }
}

export function describeRationale(
  missing: ICatalogCard,
  substitute: ICatalogCard,
  tier: TSubstitutionTier = 1,
): IRationaleDetail {
  const missingClassSet = new Set<string>(missing.classes);
  const subKeywords = new Set<string>(substitute.keywords);
  return {
    tier,
    pitch: pitchLabel(missing.pitch),
    sharedClasses: substitute.classes.filter((c) => missingClassSet.has(c)),
    powerDelta: (substitute.power ?? 0) - (missing.power ?? 0),
    defenseDelta: (substitute.defense ?? 0) - (missing.defense ?? 0),
    sharedKeywords: missing.keywords.filter((kw) => subKeywords.has(kw)),
  };
}

function deltaNote(delta: number, stat: string): string {
  if (delta === 0) return `same ${stat}`;
  return delta > 0 ? `+${delta} ${stat}` : `${delta} ${stat}`;
}

/**
 * Build a human-readable rationale for why a substitute card was chosen.
 *
 * The tier argument is appended as a prefix when the match is a softer
 * tier 2 substitution so the user sees the downgrade explicitly. Tier 1
 * matches keep the terse format to preserve Phase 0 rationale output.
 */
export function composeRationale(
  missing: ICatalogCard,
  substitute: ICatalogCard,
  tier: TSubstitutionTier = 1,
): string {
  const detail = describeRationale(missing, substitute, tier);
  const classLabel = detail.sharedClasses.length > 0 ? detail.sharedClasses.join(', ') : 'shared';
  const kwList = detail.sharedKeywords.length > 0 ? detail.sharedKeywords.join(', ') : 'no';
  const core = `Same pitch (${detail.pitch}), same ${classLabel} class, ${deltaNote(detail.powerDelta, 'power')}, ${deltaNote(detail.defenseDelta, 'defense')}, shared ${kwList} keywords.`;

  if (tier === 2) {
    return `Tier 2 substitute -- keyword overlap relaxed: ${core}`;
  }
  return core;
}
