import type { TListKind } from '../../database/entities/card-list.entity';
import { formatBrl, formatBrlShort } from './format-brl';
import type { IListMetaLine } from './preview-list';
import type { IMissingLine } from './preview-missing';
import type { IShareMeta } from './share-meta-tags';

export interface ISharedDeckSummary {
  readonly name: string;
  readonly hero: string;
  readonly format: string;
  readonly sharerName: string;
  readonly totalCards: number;
}

export const GENERIC_TITLE = 'Rathe Arsenal';
export const GENERIC_DESCRIPTION = 'Veja se o seu deck de Flesh and Blood está pronto.';

export function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

export function buildDeckShareMeta(
  deck: ISharedDeckSummary,
  token: string,
  baseUrl: string,
): IShareMeta {
  const base = trimTrailingSlash(baseUrl);
  return {
    title: deck.name,
    description: `Deck de ${deck.sharerName} no Rathe Arsenal: ${deck.hero}, ${deck.format}, ${deck.totalCards} cartas`,
    imageUrl: `${base}/api/shared/decks/${token}/image`,
    pageUrl: `${base}/d/${token}`,
  };
}

export interface IMissingDeckSummary {
  readonly name: string;
  readonly sharerName: string;
  readonly missingCount: number;
  readonly lines: readonly IMissingLine[];
}

const DESCRIPTION_LINES = 4;

function missingDescription(summary: IMissingDeckSummary): string {
  if (summary.missingCount === 0) return `${summary.sharerName} já tem todas as cartas deste deck`;
  const noun = summary.missingCount === 1 ? 'carta' : 'cartas';
  const shown = summary.lines.slice(0, DESCRIPTION_LINES).map((line) => `${line.quantity}x ${line.name}`);
  const rest = summary.lines.length - shown.length;
  const list = rest > 0 ? `${shown.join(', ')} e mais ${rest}` : shown.join(', ');
  return `${summary.sharerName} procura ${summary.missingCount} ${noun}: ${list}`;
}

export function buildMissingShareMeta(
  summary: IMissingDeckSummary,
  token: string,
  baseUrl: string,
): IShareMeta {
  const base = trimTrailingSlash(baseUrl);
  return {
    title: `Procuro cartas para ${summary.name}`,
    description: missingDescription(summary),
    imageUrl: `${base}/api/shared/decks/${token}/image`,
    pageUrl: `${base}/d/${token}`,
  };
}

export interface ISharedListSummary {
  readonly kind: TListKind;
  readonly name: string;
  readonly sharerName: string;
  readonly copyCount: number;
  readonly totalPriceCents: number | null;
  readonly lines: readonly IListMetaLine[];
}

function listLineText(kind: TListKind, line: IListMetaLine): string {
  const base = `${line.quantity}x ${line.name}`;
  return kind === 'sell' && line.priceCents !== null ? `${base} (${formatBrlShort(line.priceCents)})` : base;
}

function listDescription(summary: ISharedListSummary): string {
  if (summary.copyCount === 0) return `${summary.sharerName} ainda não tem cartas nesta lista`;
  const noun = summary.copyCount === 1 ? 'carta' : 'cartas';
  const verb = summary.kind === 'want' ? 'procura' : 'vende';
  const shown = summary.lines.slice(0, DESCRIPTION_LINES).map((line) => listLineText(summary.kind, line));
  const rest = summary.lines.length - shown.length;
  const cards = rest > 0 ? `${shown.join(', ')} e mais ${rest}` : shown.join(', ');
  const total =
    summary.kind === 'sell' && summary.totalPriceCents !== null ? `. Tudo por ${formatBrl(summary.totalPriceCents)}` : '';
  return `${summary.sharerName} ${verb} ${summary.copyCount} ${noun}: ${cards}${total}`;
}

export function buildListShareMeta(summary: ISharedListSummary, token: string, baseUrl: string): IShareMeta {
  const base = trimTrailingSlash(baseUrl);
  return {
    title: `${summary.kind === 'want' ? 'Procuro' : 'Vendo'}: ${summary.name}`,
    description: listDescription(summary),
    imageUrl: `${base}/api/shared/lists/${token}/image`,
    pageUrl: `${base}/l/${token}`,
  };
}

// The image route answers any token that is not live with the generic image, so a dead link needs no route of its own.
const GENERIC_IMAGE_TOKEN = 'unavailable';

export function buildGenericShareMeta(baseUrl: string): IShareMeta {
  const base = trimTrailingSlash(baseUrl);
  return {
    title: GENERIC_TITLE,
    description: GENERIC_DESCRIPTION,
    imageUrl: `${base}/api/shared/decks/${GENERIC_IMAGE_TOKEN}/image`,
    pageUrl: base,
  };
}
