import { ICatalog } from '@rathe-arsenal/engine';
import { RECOMMENDATION_STRENGTHS, TRecommendationStrength } from '../database/entities/recommendation.entity';
import { IGeminiEntry } from './gemini-client';
import { IDeckListCard, slotForCard } from './recommendation-prompt';

export const RECOMMENDATIONS_KEPT = 10;

export interface IKeptRecommendation {
  readonly cardIdentifier: string;
  readonly rank: number;
  readonly strength: TRecommendationStrength;
  readonly cutCardIdentifier: string | null;
  readonly cutSlot: string | null;
  readonly reason: string;
}

export interface ISelectedRecommendations {
  readonly kept: readonly IKeptRecommendation[];
  readonly dropped: number;
}

function isStrength(value: string): value is TRecommendationStrength {
  return (RECOMMENDATION_STRENGTHS as readonly string[]).includes(value);
}

export function selectRecommendations(
  entries: readonly IGeminiEntry[],
  poolIdentifiers: ReadonlySet<string>,
  deckCards: readonly IDeckListCard[],
  catalog: ICatalog,
): ISelectedRecommendations {
  const seen = new Set<string>();
  const kept: IKeptRecommendation[] = [];
  let dropped = 0;

  for (const entry of entries) {
    if (kept.length === RECOMMENDATIONS_KEPT) break;
    if (!poolIdentifiers.has(entry.card) || seen.has(entry.card) || !isStrength(entry.strength)) {
      dropped += 1;
      continue;
    }
    seen.add(entry.card);
    const slot = slotForCard(catalog.getCard(entry.card));
    const cutInSlot = deckCards.some((card) => card.cardIdentifier === entry.cut && card.slot === slot);
    kept.push({
      cardIdentifier: entry.card,
      rank: kept.length + 1,
      strength: entry.strength,
      cutCardIdentifier: cutInSlot ? entry.cut : null,
      cutSlot: cutInSlot ? slot : null,
      reason: entry.reason,
    });
  }

  return { kept, dropped };
}
