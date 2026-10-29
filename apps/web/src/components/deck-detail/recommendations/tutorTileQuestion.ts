import type { TFunction } from 'i18next';
import { isSizeProblem, type TLegalityReasonDetail } from '@rathe-arsenal/engine/legality';
import type { IDeckLegality } from '../../../api/decks';

/**
 * The first question of the Tutor tile follows the deck's state: a rule problem asks how to make the deck valid, a deck
 * that is only short of cards asks which cards to add, and a deck with neither asks how others play the hero.
 * The size comes from the engine's own size detail, not from a recount.
 */
export function firstTutorQuestion(input: {
  readonly legality: Pick<IDeckLegality, 'details'> | null | undefined;
  readonly format: string | undefined;
  readonly heroName: string;
  readonly t: TFunction;
}): string {
  const { legality, format, heroName, t } = input;
  // The saved verdict arrives from the API with codes as plain strings; they are the engine's own.
  const details = (legality?.details ?? []) as readonly TLegalityReasonDetail[];
  if (details.some((detail) => !isSizeProblem(detail))) return t('chat.tile.readyInvalid', { format: format ?? '' });
  const short = details.find((detail) => isSizeProblem(detail) && 'limit' in detail.params && detail.params.count < detail.params.limit);
  if (short !== undefined && 'limit' in short.params) return t('chat.tile.readyShort', { target: short.params.limit });
  return t('chat.tile.readyHero', { hero: heroName });
}
