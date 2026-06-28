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
} as const;

/** Type source of truth — en-US must satisfy this shape to catch missing keys at compile time. */
export type TTranslationResources = typeof ptBR;
