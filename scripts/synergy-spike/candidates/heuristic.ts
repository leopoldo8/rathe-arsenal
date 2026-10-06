/**
 * Heuristic candidate: a fixed scoring formula over the catalog, no outside data.
 *
 * FROZEN: this formula was committed before the owner recorded any verdict and
 * must not change afterwards. A retuned formula is a new candidate and needs the
 * owner's decision (plan, Out of scope: "tuning a candidate after seeing verdicts").
 *
 * score = 3 * classMatch      card shares a non-generic class with the hero
 *       + 3 * talentMatch     card shares a talent with the hero
 *       + 4 * heroSpecific    card names the hero in its legal heroes
 *       + 4 * keywordShare    mean, over the card's keywords, of the share of deck copies having it
 *       + 3 * typeShare       mean, over the card's types, of the share of deck copies having it
 *       + 8 * textSimilarity  tf-idf cosine between the card's rules text and the deck's rules text
 *       + 2 * mentions        deck card names (and the hero's) found in the card's rules text, capped at 3
 * Ties break on card identifier, ascending.
 */
import type { ICatalog, ICatalogCard } from '../../../packages/engine/src';
import { Class } from '../../../packages/engine/src';
import type { IDeckFile, IPoolFile } from '../lib/types';

const STOP_WORDS = new Set([
  'this', 'that', 'with', 'your', 'from', 'then', 'when', 'have', 'each', 'card', 'cards',
  'the', 'and', 'you', 'may', 'can', 'for', 'are', 'was', 'its', 'has', 'not', 'any', 'all',
  'into', 'until', 'there', 'their', 'they', 'them', 'would', 'could', 'which', 'while',
]);
const MIN_TOKEN_LENGTH = 4;
const MIN_NAME_LENGTH = 5;
const MENTION_CAP = 3;

type TVector = ReadonlyMap<string, number>;

function tokenize(text: string | undefined): string[] {
  return (text ?? '')
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((t) => t.length >= MIN_TOKEN_LENGTH && !STOP_WORDS.has(t));
}

function termCounts(tokens: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
  return counts;
}

function cosine(a: TVector, b: TVector): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const [term, weight] of a) {
    normA += weight * weight;
    const other = b.get(term);
    if (other !== undefined) dot += weight * other;
  }
  for (const weight of b.values()) normB += weight * weight;
  return normA === 0 || normB === 0 ? 0 : dot / Math.sqrt(normA * normB);
}

function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length;
}

function share(counts: ReadonlyMap<string, number>, key: string, total: number): number {
  return total === 0 ? 0 : (counts.get(key) ?? 0) / total;
}

function sharesAny(a: readonly string[], b: readonly string[]): boolean {
  return a.some((x) => b.includes(x));
}

export function rankHeuristic(deck: IDeckFile, pool: IPoolFile, catalog: ICatalog): string[] {
  const hero = catalog.getCard(deck.hero);
  const deckCards = deck.mainboard.map((e) => ({ card: catalog.getCard(e.card), quantity: e.quantity }));
  const poolCards = pool.cards.map((id) => catalog.getCard(id));
  const totalCopies = deckCards.reduce((sum, e) => sum + e.quantity, 0);

  const keywordCopies = new Map<string, number>();
  const typeCopies = new Map<string, number>();
  for (const { card, quantity } of deckCards) {
    for (const k of card.keywords) keywordCopies.set(k, (keywordCopies.get(k) ?? 0) + quantity);
    for (const t of card.types) typeCopies.set(t, (typeCopies.get(t) ?? 0) + quantity);
  }

  const documentFrequency = new Map<string, number>();
  const everyText = [...deckCards.map((e) => e.card), ...poolCards];
  for (const card of everyText) {
    for (const term of new Set(tokenize(card.functionalText))) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }
  const idf = (term: string): number => Math.log(1 + everyText.length / (documentFrequency.get(term) ?? 1));
  const weigh = (counts: ReadonlyMap<string, number>): Map<string, number> =>
    new Map([...counts].map(([term, count]) => [term, count * idf(term)]));

  const deckCounts = new Map<string, number>();
  for (const { card, quantity } of deckCards) {
    for (const [term, count] of termCounts(tokenize(card.functionalText))) {
      deckCounts.set(term, (deckCounts.get(term) ?? 0) + count * quantity);
    }
  }
  const deckVector = weigh(deckCounts);

  const namesToFind = [...new Set([hero.name, ...deckCards.map((e) => e.card.name)])]
    .map((n) => n.toLowerCase())
    .filter((n) => n.length >= MIN_NAME_LENGTH);

  const heroEnum = hero.hero as string | undefined;
  const heroClasses = hero.classes.filter((c) => c !== Class.Generic);

  const scored = poolCards.map((card: ICatalogCard) => {
    const text = (card.functionalText ?? '').toLowerCase();
    const mentions = Math.min(namesToFind.filter((n) => text.includes(n)).length, MENTION_CAP);
    const score =
      3 * Number(sharesAny(card.classes, heroClasses)) +
      3 * Number(sharesAny(card.talents, hero.talents)) +
      4 * Number(heroEnum !== undefined && card.legalHeroes.includes(heroEnum)) +
      4 * mean(card.keywords.map((k) => share(keywordCopies, k, totalCopies))) +
      3 * mean(card.types.map((t) => share(typeCopies, t, totalCopies))) +
      8 * cosine(weigh(termCounts(tokenize(card.functionalText))), deckVector) +
      2 * mentions;
    return { id: card.cardIdentifier, score: Math.round(score * 1e9) / 1e9 };
  });

  return scored
    .sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1))
    .map((s) => s.id);
}
