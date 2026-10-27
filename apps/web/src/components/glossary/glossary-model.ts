import type { TFunction } from 'i18next';

/** The words the glossary explains, in the order of the design document's table. */
export const GLOSSARY_TERM_IDS = [
  'formato',
  'classicConstructed',
  'livingLegend',
  'blitz',
  'silverAge',
  'youngHero',
  'adultHero',
  'cost',
  'pitch',
  'pitchColors',
  'costCurve',
  'powerDefense',
  'action',
  'attackReaction',
  'defenseReaction',
  'instant',
  'weapon',
  'equipment',
  'cardPool',
  'inventory',
  'legendary',
  'banned',
  'restricted',
  'foil',
  'free',
  'alternatives',
  'idea',
  'building',
  'ready',
  'playing',
  'retired',
] as const;

export type TGlossaryTermId = (typeof GLOSSARY_TERM_IDS)[number];

export interface IGlossaryEntry {
  readonly id: TGlossaryTermId;
  readonly word: string;
  readonly sentence: string;
}

/** What a page already holds about the player's own data, so a word can add a line about it. */
export type TGlossaryOwnData =
  | { readonly kind: 'pitch'; readonly red: number; readonly yellow: number; readonly blue: number }
  | { readonly kind: 'stage'; readonly deckName: string; readonly cards: number }
  | { readonly kind: 'format'; readonly sharerName: string; readonly format: string };

const FORMAT_TERMS: ReadonlySet<TGlossaryTermId> = new Set(['classicConstructed', 'livingLegend', 'blitz', 'silverAge']);

/** The glossary word of a format as the page writes it, or null for a format the glossary does not explain. */
export function formatTermId(format: string, t: TFunction): TGlossaryTermId | null {
  for (const id of FORMAT_TERMS) {
    if (t(`glossary.terms.${id}.word`) === format) return id;
  }
  return null;
}

export function glossaryEntry(id: TGlossaryTermId, t: TFunction): IGlossaryEntry {
  return { id, word: t(`glossary.terms.${id}.word`), sentence: t(`glossary.terms.${id}.sentence`) };
}

/** Every word with its sentence, in the alphabetical order of the active language. */
export function glossaryEntries(t: TFunction, locale: string): readonly IGlossaryEntry[] {
  return GLOSSARY_TERM_IDS.map((id) => glossaryEntry(id, t)).sort((a, b) => a.word.localeCompare(b.word, locale));
}

function pitchLine(own: Extract<TGlossaryOwnData, { kind: 'pitch' }>, t: TFunction): string | null {
  const parts = [
    own.red > 0 ? t('glossary.own.pitchRed', { count: own.red }) : null,
    own.yellow > 0 ? t('glossary.own.pitchYellow', { count: own.yellow }) : null,
    own.blue > 0 ? t('glossary.own.pitchBlue', { count: own.blue }) : null,
  ].filter((part): part is string => part !== null);
  return parts.length === 0 ? null : t('glossary.own.pitch', { counts: parts.join(', ') });
}

/** The line about the player's own data for a word, or null when the page has none for it. */
export function glossaryOwnLine(id: TGlossaryTermId, own: TGlossaryOwnData | undefined, t: TFunction): string | null {
  if (own === undefined) return null;
  if (id === 'pitch' && own.kind === 'pitch') return pitchLine(own, t);
  if (id === 'retired' && own.kind === 'stage') {
    return t('glossary.own.stage', { name: own.deckName, count: own.cards });
  }
  if (own.kind === 'format' && FORMAT_TERMS.has(id) && t(`glossary.terms.${id}.word`) === own.format) {
    return t('glossary.own.sharedFormat', { name: own.sharerName, format: own.format });
  }
  return null;
}

/** Where `/termos` takes the player back to, kept in the navigation state of the link that opened it. */
export interface IGlossaryOrigin {
  readonly path: string;
  readonly label?: string;
}

export const GLOSSARY_ORIGIN_KEY = 'glossaryFrom';

export function readGlossaryOrigin(state: unknown): IGlossaryOrigin | null {
  if (state === null || typeof state !== 'object') return null;
  const raw = (state as Record<string, unknown>)[GLOSSARY_ORIGIN_KEY];
  if (raw === null || typeof raw !== 'object') return null;
  const { path, label } = raw as Record<string, unknown>;
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) return null;
  return typeof label === 'string' ? { path, label } : { path };
}

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** The entries a search finds: the word or its sentence contains the text, ignoring case and accents. */
export function searchGlossary(entries: readonly IGlossaryEntry[], query: string): readonly IGlossaryEntry[] {
  const needle = normalize(query.trim());
  if (needle === '') return entries;
  return entries.filter((entry) => normalize(`${entry.word} ${entry.sentence}`).includes(needle));
}
