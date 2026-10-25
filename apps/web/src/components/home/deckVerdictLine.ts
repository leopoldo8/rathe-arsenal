import type { TFunction } from 'i18next';
import type { ILegalityReasonDetail } from '../../api/decks';

const SIZE_CODES: ReadonlySet<string> = new Set(['mainboard_not_exact', 'mainboard_too_small']);
const HERO_CODES: ReadonlySet<string> = new Set(['hero_unrecognized', 'hero_not_legal', 'young_hero_required', 'adult_hero_required']);

/** A kind of rule problem the cause line names, in the order the line lists them. */
type TCauseKind = 'copies' | 'banned' | 'format' | 'hero';

const KIND_BY_CODE: Readonly<Record<string, TCauseKind>> = {
  too_many_copies: 'copies',
  card_banned: 'banned',
  card_not_in_format: 'format',
  ...Object.fromEntries([...HERO_CODES].map((code) => [code, 'hero'])),
};

const KIND_ORDER: readonly TCauseKind[] = ['copies', 'banned', 'format', 'hero'];
const MAX_NAMED_KINDS = 2;

export function isSizeDetail(detail: ILegalityReasonDetail): boolean {
  return SIZE_CODES.has(detail.code);
}

/** The deck size the engine asked for and the deck holds, when the size is the problem. */
export function sizeProblemOf(
  details: readonly ILegalityReasonDetail[] | undefined,
): { readonly count: number; readonly limit: number } | null {
  const detail = details?.find(isSizeDetail);
  if (detail === undefined) return null;
  return { count: Number(detail.params['count']), limit: Number(detail.params['limit']) };
}

function phraseFor(kind: TCauseKind, details: readonly ILegalityReasonDetail[], t: TFunction): string {
  const count = details.length;
  if (kind === 'hero') return t('home.causeHero');
  if (kind === 'banned') return t('home.causeBanned', { count });
  if (kind === 'format') return t('home.causeFormat', { count });
  const perCard = new Set(details.map((detail) => Number(detail.params['count'])));
  return perCard.size === 1
    ? t('home.causeCopiesSame', { count, copies: [...perCard][0] })
    : t('home.causeCopiesMixed', { count });
}

/**
 * The red line under the verdict chip of a deck with a rule problem: one item per kind of problem,
 * at most two joined by " · ", then "e mais N" for the kinds left out. The deck size is never a rule
 * problem. A problem with no wording of its own (the card pool, a card the hero cannot use) counts
 * toward "e mais N" and is not named. Null when there is nothing to name.
 */
export function deckCauseLine(details: readonly ILegalityReasonDetail[] | undefined, t: TFunction): string | null {
  const rule = (details ?? []).filter((detail) => !isSizeDetail(detail));
  const byKind = new Map<TCauseKind, ILegalityReasonDetail[]>();
  let unnamedKinds = new Set<string>();
  for (const detail of rule) {
    const kind = KIND_BY_CODE[detail.code];
    if (kind === undefined) {
      unnamedKinds = new Set([...unnamedKinds, detail.code]);
      continue;
    }
    byKind.set(kind, [...(byKind.get(kind) ?? []), detail]);
  }

  const present = KIND_ORDER.filter((kind) => byKind.has(kind));
  const named = present.slice(0, MAX_NAMED_KINDS).map((kind) => phraseFor(kind, byKind.get(kind) ?? [], t));
  if (named.length === 0) return null;

  const left = present.length - named.length + unnamedKinds.size;
  const line = named.join(' · ');
  return left > 0 ? `${line} ${t('home.causeMore', { count: left })}` : line;
}
