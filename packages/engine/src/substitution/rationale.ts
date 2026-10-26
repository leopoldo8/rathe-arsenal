import { Class, ICatalogCard } from '../catalog/types';
import { TSubstitutionTier } from './types';

export type TRationalePitch = 'red' | 'yellow' | 'blue' | 'colorless';

/** How the candidate's pitch relates to the original's: the same one, or another with both named. */
export type TRationalePitchRelation =
  | { readonly relation: 'same'; readonly pitch: TRationalePitch }
  | { readonly relation: 'different'; readonly original: TRationalePitch; readonly candidate: TRationalePitch };

/** The comparison facts behind a rationale, so clients can phrase it in their own locale. */
export interface IRationaleDetail {
  readonly tier: TSubstitutionTier;
  /** The original card's pitch. */
  readonly pitch: TRationalePitch;
  readonly pitchRelation: TRationalePitchRelation;
  /** The original card's classes, so a client never has to guess what the cards share. */
  readonly originalClasses: readonly string[];
  /** Classes both cards carry; Generic is never one of them, it is not a class a card can share. */
  readonly sharedClasses: readonly string[];
  readonly candidateGeneric: boolean;
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
  const originalPitch = pitchLabel(missing.pitch);
  const candidatePitch = pitchLabel(substitute.pitch);
  return {
    tier,
    pitch: originalPitch,
    pitchRelation:
      originalPitch === candidatePitch
        ? { relation: 'same', pitch: originalPitch }
        : { relation: 'different', original: originalPitch, candidate: candidatePitch },
    originalClasses: missing.classes,
    sharedClasses: substitute.classes.filter((c) => c !== Class.Generic && missingClassSet.has(c)),
    candidateGeneric: substitute.classes.includes(Class.Generic),
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
  const kwList = detail.sharedKeywords.length > 0 ? detail.sharedKeywords.join(', ') : 'no';
  const relation = detail.pitchRelation;
  const pitchPhrase =
    relation.relation === 'same'
      ? `Same pitch (${relation.pitch})`
      : `Different pitch: ${relation.candidate} instead of ${relation.original}`;
  const classPhrase = detail.candidateGeneric
    ? 'generic card'
    : detail.sharedClasses.length > 0
      ? `same ${detail.sharedClasses.join(', ')} class`
      : null;
  const parts = [
    pitchPhrase,
    ...(classPhrase === null ? [] : [classPhrase]),
    deltaNote(detail.powerDelta, 'power'),
    deltaNote(detail.defenseDelta, 'defense'),
    `shared ${kwList} keywords`,
  ];
  const core = `${parts.join(', ')}.`;

  if (tier === 2) {
    return `Tier 2 substitute -- keyword overlap relaxed: ${core}`;
  }
  return core;
}
