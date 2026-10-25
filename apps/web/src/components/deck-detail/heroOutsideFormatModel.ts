import type { TFunction } from 'i18next';
import type { ILegalityReasonDetail } from '../../api/decks';
import { formatLegalityReason } from '../../i18n/format-reasons';

const SIZE_CODES: ReadonlySet<string> = new Set(['mainboard_not_exact', 'mainboard_too_small']);
const CARD_SCOPE_CODES: ReadonlySet<string> = new Set(['card_banned', 'card_not_in_format', 'card_not_for_hero']);

export interface IOtherFormatVerdict {
  readonly format: string;
  readonly category: 'legal' | 'incomplete' | 'illegal' | 'unchecked';
  readonly details: readonly ILegalityReasonDetail[];
}

export function hasHeroOutsideFormat(details: readonly ILegalityReasonDetail[] | undefined): boolean {
  return (details ?? []).some((detail) => detail.code === 'hero_not_legal');
}

export function ruleDetails(details: readonly ILegalityReasonDetail[] | undefined): readonly ILegalityReasonDetail[] {
  return (details ?? []).filter((detail) => !SIZE_CODES.has(detail.code));
}

function joinList(items: readonly string[], language: string): string {
  return new Intl.ListFormat(language, { style: 'long', type: 'conjunction' }).format(items);
}

export function describeProblem(detail: ILegalityReasonDetail, t: TFunction, language: string): string {
  const params = detail.params;
  if (detail.code === 'hero_not_legal') {
    const allowed = Array.isArray(params['allowedFormats']) ? (params['allowedFormats'] as readonly string[]) : [];
    return allowed.length > 0
      ? t('deckDetail.outsideHeroAllowed', { hero: params['hero'], format: params['format'], allowed: joinList(allowed, language) })
      : t('deckDetail.outsideHeroNowhere', { hero: params['hero'], format: params['format'] });
  }
  if (detail.code === 'card_banned') {
    return t('deckDetail.outsideBanned', { card: params['card'], format: params['format'] });
  }
  return formatLegalityReason(detail, '', t);
}

/** What stops being a problem in a format where the deck is valid: the hero and the cards a rule refused. */
export function vanishingSubjects(details: readonly ILegalityReasonDetail[], t: TFunction): readonly string[] {
  const subjects: string[] = [];
  for (const detail of details) {
    const subject =
      detail.code === 'hero_not_legal'
        ? t('deckDetail.outsideSubjectHero')
        : CARD_SCOPE_CODES.has(detail.code)
          ? t('deckDetail.outsideSubjectCard', { card: detail.params['card'] })
          : null;
    if (subject !== null && !subjects.includes(subject)) subjects.push(subject);
  }
  return subjects;
}

export function describeValidIn(format: string, details: readonly ILegalityReasonDetail[], t: TFunction, language: string): string {
  const subjects = vanishingSubjects(details, t);
  if (subjects.length === 0) return t('deckDetail.outsideValidInPlain', { format });
  return t('deckDetail.outsideValidIn', { format, subjects: joinList(subjects, language), count: subjects.length });
}
