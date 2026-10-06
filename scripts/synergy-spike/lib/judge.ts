import type { ICatalog, ICatalogCard } from '../../../packages/engine/src';
import { readDecks } from './io';
import type { ISheetRow } from './sheet';

export const VERDICTS = ['yes', 'no', ''] as const;
export type TVerdict = (typeof VERDICTS)[number];

type TImage = ICatalogCard['imageUrl'];

export interface IJudgeCard {
  readonly card: string;
  readonly name: string;
  readonly typeLine: string;
  readonly pitch: number | null;
  readonly cost: number | null;
  readonly power: number | null;
  readonly defense: number | null;
  readonly rules: string;
  readonly image: TImage;
}

export interface IJudgeDeck {
  readonly deck: string;
  readonly name: string;
  readonly url: string;
  readonly format: string;
  readonly hero: IJudgeCard;
  readonly mainboard: readonly (IJudgeCard & { readonly quantity: number })[];
}

export interface IJudgeRow extends IJudgeCard {
  readonly deck: string;
  readonly verdict: TVerdict;
}

// Must stay built from the sheet, decks and catalog only: reading the key or the
// runs here would tell the judge which candidate proposed each card.
export interface IJudgePayload {
  readonly decks: readonly IJudgeDeck[];
  readonly rows: readonly IJudgeRow[];
}

export interface IVerdictInput {
  readonly deck: string;
  readonly card: string;
  readonly verdict: string;
}

function describeCard(catalog: ICatalog, identifier: string): IJudgeCard {
  const card = catalog.indices.byIdentifier.get(identifier);
  if (!card) {
    return { card: identifier, name: identifier, typeLine: '', pitch: null, cost: null, power: null, defense: null, rules: '', image: null };
  }
  const typeLine = [card.types.join(' '), card.subtypes.join(' ')].filter((part) => part !== '').join(' - ');
  return {
    card: identifier,
    name: card.name,
    typeLine,
    pitch: card.pitch,
    cost: card.cost,
    power: card.power,
    defense: card.defense,
    rules: card.functionalText ?? '',
    image: card.imageUrl,
  };
}

export function normalizeVerdict(value: string): TVerdict {
  const trimmed = value.trim().toLowerCase();
  return (VERDICTS as readonly string[]).includes(trimmed) ? (trimmed as TVerdict) : '';
}

export function buildJudgePayload(out: string, rows: readonly ISheetRow[], catalog: ICatalog): IJudgePayload {
  const decks = readDecks(out).map(
    (deck): IJudgeDeck => ({
      deck: deck.deck,
      name: deck.name,
      url: deck.url,
      format: deck.format,
      hero: describeCard(catalog, deck.hero),
      mainboard: deck.mainboard.map((entry) => ({ ...describeCard(catalog, entry.card), quantity: entry.quantity })),
    }),
  );
  return {
    decks,
    rows: rows.map((row) => ({ ...describeCard(catalog, row.card), deck: row.deck, verdict: normalizeVerdict(row.verdict) })),
  };
}

export function applyVerdict(rows: readonly ISheetRow[], input: IVerdictInput): ISheetRow[] {
  if (!(VERDICTS as readonly string[]).includes(input.verdict)) {
    throw new Error(`verdict must be yes, no or empty, got "${input.verdict}"`);
  }
  const index = rows.findIndex((row) => row.deck === input.deck && row.card === input.card);
  if (index === -1) {
    throw new Error(`no sheet row for deck ${input.deck} and card ${input.card}`);
  }
  return rows.map((row, i) => (i === index ? { ...row, verdict: input.verdict } : row));
}
