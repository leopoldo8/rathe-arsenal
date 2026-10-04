import type { TFunction } from 'i18next';
import type { IDeckLegality, ILegalityReasonDetail } from '../api/decks';
import type { IRationaleDetail } from '../api/swaps';

const PITCH_KEYS: Readonly<Record<string, string>> = {
  red: 'reasons.rationale.pitchRed',
  yellow: 'reasons.rationale.pitchYellow',
  blue: 'reasons.rationale.pitchBlue',
};

export function formatLegalityReason(
  detail: ILegalityReasonDetail | undefined,
  fallback: string,
  t: TFunction,
): string {
  if (!detail) return fallback;
  const code =
    detail.code === 'too_many_copies' && detail.params.legendary === true ? 'too_many_copies_legendary' : detail.code;
  const key = `reasons.legality.${code}`;
  if (!t(key, { defaultValue: '' })) return fallback;
  return t(key, { ...detail.params });
}

function signed(delta: number): string {
  return delta > 0 ? `+${delta}` : String(delta);
}

export function formatSwapRationale(
  detail: IRationaleDetail | null | undefined,
  fallback: string,
  t: TFunction,
): string {
  if (!detail) return fallback;
  const sentence = t('reasons.rationale.sentence', {
    pitch: t(PITCH_KEYS[detail.pitch] ?? 'reasons.rationale.pitchColorless'),
    classes:
      detail.sharedClasses.length > 0
        ? t('reasons.rationale.classesShared', { classes: detail.sharedClasses.join(', ') })
        : t('reasons.rationale.classesNone'),
    power:
      detail.powerDelta === 0
        ? t('reasons.rationale.powerSame')
        : t('reasons.rationale.powerDelta', { delta: signed(detail.powerDelta) }),
    defense:
      detail.defenseDelta === 0
        ? t('reasons.rationale.defenseSame')
        : t('reasons.rationale.defenseDelta', { delta: signed(detail.defenseDelta) }),
    keywords:
      detail.sharedKeywords.length > 0
        ? t('reasons.rationale.keywordsShared', { keywords: detail.sharedKeywords.join(', ') })
        : t('reasons.rationale.keywordsNone'),
  });
  return detail.tier === 2 ? `${t('reasons.rationale.tier2Prefix')}${sentence}` : sentence;
}

export function localizeLegalityReasons(legality: IDeckLegality, t: TFunction): readonly string[] {
  return legality.reasons.map((reason, index) => formatLegalityReason(legality.details?.[index], reason, t));
}
