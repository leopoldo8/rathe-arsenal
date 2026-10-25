import type { TTranslationResources } from '../pt-BR';
import { common } from './common';
import { shell } from './shell';
import { home } from './home';
import { onboarding } from './onboarding';
import { auth } from './auth';
import { account } from './account';
import { apiErrors } from './apiErrors';
import { library } from './library';
import { csvSources } from './csvSources';
import { copyVersions } from './copyVersions';
import { collectionReader } from './collectionReader';
import { products } from './products';
import { decks } from './decks';
import { deckDetail } from './deckDetail';
import { deckEdit } from './deckEdit';
import { variantQueue } from './variantQueue';
import { settings } from './settings';
import { ui } from './ui';
import { about } from './about';
import { reasons } from './reasons';
import { scanner } from './scanner';
import { alternatives } from './alternatives';
import { recommendations } from './recommendations';
import { chat } from './chat';
import { sharing } from './sharing';
import { lists } from './lists';

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
  account,
  apiErrors,
  library,
  csvSources,
  copyVersions,
  collectionReader,
  products,
  decks,
  deckDetail,
  deckEdit,
  variantQueue,
  settings,
  ui,
  about,
  reasons,
  scanner,
  alternatives,
  recommendations,
  chat,
  sharing,
  lists,
};
