import { CONDITIONS, TCondition } from '../../database/entities/card-list-line.entity';

/** `''` is "Não sei": the one word for a version part nobody told us. */
export type TEdition = 'first' | 'unlimited' | 'alpha';
/** `none` is "Sem foil", a known finish; `''` is unknown. */
export type TFinish = 'none' | 'rainbow' | 'cold' | 'gold';

export const EDITIONS: readonly TEdition[] = ['first', 'unlimited', 'alpha'];
export const FINISHES: readonly TFinish[] = ['none', 'rainbow', 'cold', 'gold'];
export { CONDITIONS };

export const EDITION_VALUES: readonly string[] = ['', ...EDITIONS];
export const FINISH_VALUES: readonly string[] = ['', ...FINISHES];
export const CONDITION_VALUES: readonly string[] = ['', ...CONDITIONS];

export interface ICopyVersion {
  readonly printingCode: string;
  readonly edition: '' | TEdition;
  readonly finish: '' | TFinish;
  readonly condition: '' | TCondition;
}

/** The parts of a version a request named; the rest stay "Não sei". */
export type TVersionParts = { readonly [K in keyof ICopyVersion]?: ICopyVersion[K] | undefined };

export const NO_VERSION: ICopyVersion = { printingCode: '', edition: '', finish: '', condition: '' };

export function isUnversioned(version: ICopyVersion): boolean {
  return (
    version.printingCode === '' &&
    version.edition === '' &&
    version.finish === '' &&
    version.condition === ''
  );
}

/** Fills the parts a request left out with "Não sei". */
export function withDefaults(partial: TVersionParts): ICopyVersion {
  return {
    printingCode: partial.printingCode ?? '',
    edition: partial.edition ?? '',
    finish: partial.finish ?? '',
    condition: partial.condition ?? '',
  };
}

export function sameVersion(a: ICopyVersion, b: ICopyVersion): boolean {
  return (
    a.printingCode === b.printingCode &&
    a.edition === b.edition &&
    a.finish === b.finish &&
    a.condition === b.condition
  );
}
