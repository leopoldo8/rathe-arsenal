import { common } from './common';
import { shell } from './shell';
import { home } from './home';
import { onboarding } from './onboarding';
import { auth } from './auth';
import { apiErrors } from './apiErrors';
import { library } from './library';
import { csvSources } from './csvSources';
import { decks } from './decks';
import { reviews } from './reviews';
import { variantQueue } from './variantQueue';
import { settings } from './settings';
import { ui } from './ui';
import { about } from './about';

export const ptBR = {
  common,
  shell,
  home,
  onboarding,
  auth,
  apiErrors,
  library,
  csvSources,
  decks,
  reviews,
  variantQueue,
  settings,
  ui,
  about,
} as const;

/**
 * Widen leaf string-literal types to `string` so EN-US can hold *different*
 * translated values while still being checked for the *same key structure*.
 *
 * Using `typeof ptBR` directly would force every EN-US value to equal PT-BR's
 * literal (e.g. `'Language'` is not assignable to `'Idioma'`), which is
 * impossible for real translations. This enforces key parity, not value
 * identity. Runtime key parity (including accidental EXTRA keys, which the
 * structural type cannot catch on imported consts) is guarded by
 * `i18n/__tests__/catalog-parity.spec.ts`.
 */
type WidenLeaves<T> = {
  [K in keyof T]: T[K] extends string ? string : WidenLeaves<T[K]>;
};

/** Type source of truth — en-US must satisfy this key shape (missing key = compile error). */
export type TTranslationResources = WidenLeaves<typeof ptBR>;
