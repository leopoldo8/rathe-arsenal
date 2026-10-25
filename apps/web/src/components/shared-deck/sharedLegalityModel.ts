import type { TFunction } from 'i18next';
import type { ISharedFormatVerdict } from '../../api/shared-decks';
import { cardName } from '../../lib/card-name';
import { formatLegalityReason } from '../../i18n/format-reasons';

type TDetail = ISharedFormatVerdict['details'][number];

const SIZE_CODES: ReadonlySet<string> = new Set(['mainboard_not_exact', 'mainboard_too_small']);
const CARD_SCOPE_CODES: ReadonlySet<string> = new Set(['card_banned', 'card_not_in_format', 'card_not_for_hero']);
const HERO_CODES: ReadonlySet<string> = new Set(['hero_unrecognized', 'hero_not_legal', 'young_hero_required', 'adult_hero_required']);

const asNumber = (value: unknown): number => Number(value);

function pitchOf(detail: TDetail): number | null {
  const pitch = detail.params['pitch'];
  return typeof pitch === 'number' ? pitch : null;
}

function namedCard(detail: TDetail, t: TFunction): string {
  return cardName(String(detail.params['card']), pitchOf(detail), t as (key: string) => string);
}

function joinList(items: readonly string[], language: string): string {
  return new Intl.ListFormat(language, { style: 'long', type: 'conjunction' }).format(items);
}

export function sizeDetailOf(details: ISharedFormatVerdict['details']): TDetail | undefined {
  return details.find((detail) => SIZE_CODES.has(detail.code));
}

export function ruleDetailsOf(details: ISharedFormatVerdict['details']): readonly TDetail[] {
  return details.filter((detail) => !SIZE_CODES.has(detail.code));
}

export function describeSize(detail: TDetail, t: TFunction): string {
  const params = { count: asNumber(detail.params['count']), limit: asNumber(detail.params['limit']), format: detail.params['format'] };
  return t(detail.code === 'mainboard_not_exact' ? 'sharing.legality.sizeExact' : 'sharing.legality.sizeMin', params);
}

export function describeRule(detail: TDetail, t: TFunction): string {
  if (detail.code === 'too_many_copies') {
    const params = { card: namedCard(detail, t), count: asNumber(detail.params['count']), limit: asNumber(detail.params['limit']), format: detail.params['format'] };
    if (detail.params['legendary'] === true) return t('sharing.legality.copiesLegendary', params);
    return t(detail.params['restricted'] === true ? 'sharing.legality.copiesRestricted' : 'sharing.legality.copies', params);
  }
  return formatLegalityReason(detail as never, '', t);
}

function takeStep(detail: TDetail, t: TFunction): string | null {
  if (detail.code === 'too_many_copies') {
    return t('sharing.legality.stepTake', { count: asNumber(detail.params['count']) - asNumber(detail.params['limit']), card: namedCard(detail, t) });
  }
  if (CARD_SCOPE_CODES.has(detail.code)) return t('sharing.legality.stepTakeOut', { card: namedCard(detail, t) });
  if (HERO_CODES.has(detail.code)) return t('sharing.legality.stepChangeHero');
  return null;
}

function sizeStep(details: ISharedFormatVerdict['details'], t: TFunction): string | null {
  const size = sizeDetailOf(details);
  if (size === undefined) return null;
  const taken = details
    .filter((detail) => detail.code === 'too_many_copies')
    .reduce((sum, detail) => sum + asNumber(detail.params['count']) - asNumber(detail.params['limit']), 0);
  const gap = asNumber(size.params['limit']) - (asNumber(size.params['count']) - taken);
  if (gap > 0) return t('sharing.legality.stepAdd', { count: gap });
  if (gap < 0 && size.code === 'mainboard_not_exact') return t('sharing.legality.stepRemoveExtra', { count: -gap });
  return null;
}

/** "Para jogar no Blitz: tirar 1 Pack Hunt (Vermelho) e colocar mais 10 cartas." Null when nothing is left to say. */
export function describeWayToPlay(
  format: string,
  details: ISharedFormatVerdict['details'],
  t: TFunction,
  language: string,
): string | null {
  const steps = [...ruleDetailsOf(details).map((detail) => takeStep(detail, t)), sizeStep(details, t)].filter(
    (step): step is string => step !== null,
  );
  return steps.length === 0 ? null : t('sharing.legality.wayToPlay', { format, steps: joinList(steps, language) });
}

/** What a tapped format chip says: valid, or not valid with its first reason. */
export function describeOtherFormat(
  verdict: ISharedFormatVerdict & { readonly format: string },
  heroYoung: boolean | null,
  t: TFunction,
  language: string,
): string {
  const { format } = verdict;
  if (verdict.category === 'legal') return t('sharing.legality.otherLegal', { format });
  const heroProblem = verdict.details.find((detail) => detail.code === 'hero_not_legal');
  const allowed = heroProblem !== undefined && Array.isArray(heroProblem.params['allowedFormats']) ? (heroProblem.params['allowedFormats'] as readonly string[]) : [];
  if (heroProblem !== undefined && allowed.length > 0) {
    return t(heroYoung === true ? 'sharing.legality.otherHeroOnlyYoung' : 'sharing.legality.otherHeroOnly', {
      format,
      hero: heroProblem.params['hero'],
      formats: joinList(allowed, language),
    });
  }
  const rule = ruleDetailsOf(verdict.details)[0];
  if (rule !== undefined) return t('sharing.legality.otherIllegal', { format, reason: describeRule(rule, t) });
  const size = sizeDetailOf(verdict.details);
  return size === undefined
    ? t('sharing.legality.otherIllegalPlain', { format })
    : t('sharing.legality.otherIncomplete', { format, reason: describeSize(size, t) });
}
