import type { TFunction } from 'i18next';
import type { TCondition, TEdition, TFinish } from '../../api/collection-versions';

/** A version as the API sends it: every part a plain string, `''` or absent when unknown. */
export interface IVersionParts {
  readonly printingCode?: string | undefined;
  readonly edition?: string | undefined;
  readonly finish?: string | undefined;
  readonly condition?: string | undefined;
}

export const EDITION_OPTIONS: readonly TEdition[] = ['first', 'alpha', 'unlimited'];
export const FINISH_OPTIONS: readonly TFinish[] = ['none', 'rainbow', 'cold', 'gold'];
/** The card picker offers these four; DMG exists in the vocabulary but is not offered here. */
export const CONDITION_OPTIONS: readonly TCondition[] = ['NM', 'LP', 'MP', 'HP'];

const EDITION_KEYS: Readonly<Record<TEdition, string>> = {
  first: 'copyVersions.editionFirst',
  alpha: 'copyVersions.editionAlpha',
  unlimited: 'copyVersions.editionUnlimited',
};
const FINISH_KEYS: Readonly<Record<TFinish, string>> = {
  none: 'copyVersions.finishNone',
  rainbow: 'copyVersions.finishRainbow',
  cold: 'copyVersions.finishCold',
  gold: 'copyVersions.finishGold',
};

export function editionLabel(edition: TEdition, t: TFunction): string {
  return t(EDITION_KEYS[edition]);
}

export function finishLabel(finish: TFinish, t: TFunction): string {
  return t(FINISH_KEYS[finish]);
}

/**
 * "Welcome to Rathe · Unlimited · Rainbow Foil · NM": the parts a copy's version names, in that order.
 * The set name stands for the printing code when it is known; empty parts are left out, and an empty
 * result means nothing is known.
 */
export function describeVersion(
  version: IVersionParts,
  t: TFunction,
  setNameOf: (printingCode: string) => string | null = () => null,
): string {
  const printing = version.printingCode ? (setNameOf(version.printingCode) ?? version.printingCode) : '';
  return [
    printing,
    version.edition ? editionLabel(version.edition as TEdition, t) : '',
    version.finish ? finishLabel(version.finish as TFinish, t) : '',
    version.condition ?? '',
  ]
    .filter((part) => part !== '')
    .join(' · ');
}

export function isUnversioned(version: IVersionParts): boolean {
  return !version.printingCode && !version.edition && !version.finish && !version.condition;
}

export function versionKey(version: IVersionParts): string {
  return [version.printingCode ?? '', version.edition ?? '', version.finish ?? '', version.condition ?? ''].join('|');
}
