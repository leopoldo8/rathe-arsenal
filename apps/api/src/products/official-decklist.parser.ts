import type { catalog as TCatalog } from '@rathe-arsenal/engine';
import { readPitchToken } from '../collection/reader/pitch-token';
import { FORMAT_BY_KIND, IProductCard, IProductFile, TProductKind } from './product-file';

type TEngineCatalog = typeof TCatalog;

export interface IOfficialCard {
  readonly name: string;
  readonly pitch: number | null;
  readonly quantity: number;
}

export interface IParsedProduct {
  readonly file: IProductFile;
  /** One line per difference between the official page and the catalog's printings for the product. */
  readonly differences: readonly string[];
}

const CARD_ITEM = /<li class="card-item[^"]*">\s*<div class="card-name">\s*<span>(\d+)x<\/span>\s*([^<]+?)\s*<\/div>/g;
const PITCH_SUFFIX = /^(.*?)\s*\(([a-z]+)\)$/i;
const KIND_PREFIX: Readonly<Record<TProductKind, string>> = { armory: 'armory', blitz: 'blitz', silver_age: 'silver-age' };
const PRODUCT_SET: Readonly<Record<TProductKind, RegExp>> = {
  armory: /^Armory Deck: /,
  blitz: /Blitz Deck$/,
  silver_age: /Silver Age Deck$/,
};

/** The cards of an official decklist page, in page order, with quantity and pitch read from "(red)". */
export function extractOfficialCards(html: string): IOfficialCard[] {
  const cards: IOfficialCard[] = [];
  for (const match of html.matchAll(CARD_ITEM)) {
    const written = decodeEntities(match[2]!);
    const suffix = PITCH_SUFFIX.exec(written);
    const pitch = suffix === null ? null : (readPitchToken(suffix[2]!)?.pitch ?? null);
    const name = suffix !== null && pitch !== null ? suffix[1]! : written;
    cards.push({ name, pitch, quantity: Number(match[1]) });
  }
  return cards;
}

function decodeEntities(text: string): string {
  return text.replace(/&amp;/g, '&').replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"');
}

export function productKindFromUrl(url: string): TProductKind | null {
  const slug = url.toLowerCase();
  if (slug.includes('armory')) return 'armory';
  if (slug.includes('blitz')) return 'blitz';
  if (slug.includes('silver')) return 'silver_age';
  return null;
}

function titleSegments(html: string): string[] {
  const title = /<title>([^<]*)<\/title>/i.exec(html)?.[1] ?? '';
  return decodeEntities(title).split(' - ').map((segment) => segment.trim());
}

const pitchName = (pitch: number | null): string => (pitch === 1 ? 'red' : pitch === 2 ? 'yellow' : pitch === 3 ? 'blue' : '');
const describe = (name: string, pitch: number | null): string => (pitch === null ? name : `${name} (${pitchName(pitch)})`);

function typesOf(catalog: TEngineCatalog, cardIdentifier: string): readonly string[] {
  return (catalog.getRawCard(cardIdentifier) as { types?: readonly string[] }).types ?? [];
}

function findHero(catalog: TEngineCatalog, html: string): string {
  for (const segment of titleSegments(html)) {
    const hero = (catalog.indices.byName.get(segment.toLowerCase()) ?? []).find((card) => typesOf(catalog, card.cardIdentifier).includes('Hero'));
    if (hero !== undefined) return hero.cardIdentifier;
  }
  throw new Error('The page title does not name a hero of the catalog');
}

function tagged(catalog: TEngineCatalog, cardIdentifier: string, productName: string): string[] {
  const raw = catalog.getRawCard(cardIdentifier) as { printings?: ReadonlyArray<{ identifier?: string; set?: string }> };
  const codes = (raw.printings ?? []).filter((row) => row.set === productName && row.identifier).map((row) => row.identifier!);
  return [...new Set(codes)];
}

function productNameOf(catalog: TEngineCatalog, heroIdentifier: string, kind: TProductKind): string {
  const raw = catalog.getRawCard(heroIdentifier) as { printings?: ReadonlyArray<{ set?: string }> };
  const sets = (raw.printings ?? []).map((row) => row.set ?? '').filter((set) => PRODUCT_SET[kind].test(set));
  const [first] = sets;
  if (first === undefined) throw new Error('The catalog has no product of this kind for the hero');
  return first;
}

/**
 * Turns an official decklist page into a product file: each card to the catalog's printing tagged with
 * the product, tokens left out, and every difference between the page and the catalog listed.
 */
export function buildProductFile(html: string, url: string, catalog: TEngineCatalog): IParsedProduct {
  const kind = productKindFromUrl(url);
  if (kind === null) throw new Error('The address is not an Armory, Blitz or Silver Age decklist');
  const hero = findHero(catalog, html);
  const name = productNameOf(catalog, hero, kind);
  const heroName = catalog.getCard(hero).name;
  const differences: string[] = [];
  const cards: IProductCard[] = [];
  const onPage = new Set<string>();

  for (const official of extractOfficialCards(html)) {
    const sameName = catalog.indices.byName.get(official.name.toLowerCase()) ?? [];
    const matches = sameName.filter((card) => official.pitch === null || card.pitch === official.pitch);
    const [card] = matches;
    if (matches.length !== 1 || card === undefined) {
      differences.push(`not in the catalog: ${describe(official.name, official.pitch)}`);
      continue;
    }
    if (typesOf(catalog, card.cardIdentifier).includes('Token')) continue;
    onPage.add(card.cardIdentifier);
    const [printingCode] = tagged(catalog, card.cardIdentifier, name);
    if (printingCode === undefined) {
      differences.push(`no printing tagged with ${name}: ${describe(official.name, official.pitch)}`);
      continue;
    }
    cards.push({ cardIdentifier: card.cardIdentifier, printingCode, quantity: official.quantity });
  }

  for (const card of catalog.cards) {
    if (onPage.has(card.cardIdentifier) || typesOf(catalog, card.cardIdentifier).includes('Token')) continue;
    if (tagged(catalog, card.cardIdentifier, name).length > 0) {
      differences.push(`in the catalog for ${name}, not on the page: ${describe(card.name, card.pitch)}`);
    }
  }

  const key = `${KIND_PREFIX[kind]}-${heroName.split(/[,\s]/)[0]!.toLowerCase()}`;
  return { file: { key, name, kind, format: FORMAT_BY_KIND[kind], hero, cards }, differences };
}
