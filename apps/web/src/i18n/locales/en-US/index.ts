import type { TTranslationResources } from '../pt-BR';
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

/**
 * EN-US catalog typed against TTranslationResources (typeof ptBR) — a missing
 * or renamed key in this aggregate is a compile error, enforcing key parity.
 */
export const enUS: TTranslationResources = {
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
};
