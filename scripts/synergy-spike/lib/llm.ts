import type { ICatalog, ICatalogCard } from '../../../packages/engine/src';
import { toRunFile } from './run-file';
import type { IDeckFile, IPoolFile, IRunFile } from './types';

export const LLM_MODEL = 'claude-opus-5-5';
/** Adaptive thinking draws on this budget too, so it is set above the 8,000 the output alone needs. */
export const LLM_MAX_TOKENS = 16000;
export const LLM_ASK_COUNT = 25;

export interface ILlmRequest {
  readonly model: string;
  readonly maxTokens: number;
  readonly system: string;
  readonly prompt: string;
}

export interface ILlmResponse {
  readonly text: string;
  readonly stopReason: string | null;
  readonly usage: { readonly inputTokens: number; readonly outputTokens: number };
}

export interface ILlmClient {
  countTokens(request: ILlmRequest): Promise<number>;
  generate(request: ILlmRequest): Promise<ILlmResponse>;
}

const SYSTEM_PROMPT = [
  'You help a Flesh and Blood player choose cards for a deck he already built.',
  'Pick the cards that make the deck\'s other cards work better and serve its strategy, not the cards that merely resemble the deck\'s cards.',
  'Judge only from the rules text given. Answer only with cards from the candidate pool, using their exact identifiers.',
].join(' ');

function typeLine(card: ICatalogCard): string {
  return [...card.classes, ...card.talents, ...card.types, ...card.subtypes].join(' ');
}

function cardLine(card: ICatalogCard, quantity?: number): string {
  const prefix = quantity === undefined ? '' : `${quantity}x `;
  return `${prefix}${card.cardIdentifier} | ${card.name} | ${typeLine(card)} | ${card.functionalText ?? ''}`;
}

export function buildRequest(deck: IDeckFile, pool: IPoolFile, catalog: ICatalog): ILlmRequest {
  const hero = catalog.getCard(deck.hero);
  const deckLines = deck.mainboard.map((e) => cardLine(catalog.getCard(e.card), e.quantity));
  const poolLines = pool.cards.map((id) => cardLine(catalog.getCard(id)));
  const prompt = [
    `Hero: ${hero.name} | ${typeLine(hero)} | ${hero.functionalText ?? ''}`,
    `Format: ${deck.format}`,
    '',
    'Deck (mainboard):',
    ...deckLines,
    '',
    `Candidate pool (${pool.size} cards, format: identifier | name | type line | rules text):`,
    ...poolLines,
    '',
    `Rank the ${LLM_ASK_COUNT} cards from the candidate pool that best fit this deck, best first, each with one sentence of reason.`,
  ].join('\n');
  return { model: LLM_MODEL, maxTokens: LLM_MAX_TOKENS, system: SYSTEM_PROMPT, prompt };
}

/** JSON schema the SDK adapter sends as the structured output format. */
export const RANKING_SCHEMA = {
  type: 'object',
  properties: {
    ranking: {
      type: 'array',
      items: {
        type: 'object',
        properties: { card: { type: 'string' }, reason: { type: 'string' } },
        required: ['card', 'reason'],
        additionalProperties: false,
      },
    },
  },
  required: ['ranking'],
  additionalProperties: false,
} as const;

interface IRankingEntry {
  readonly card: string;
  readonly reason: string;
}

function parseRanking(text: string): readonly IRankingEntry[] | null {
  try {
    const parsed = JSON.parse(text) as { ranking?: IRankingEntry[] };
    return Array.isArray(parsed.ranking) ? parsed.ranking : null;
  } catch {
    return null;
  }
}

/** One request for one deck. A refusal or a truncation is recorded and never retried. */
export async function runLlmDeck(
  deck: IDeckFile,
  pool: IPoolFile,
  catalog: ICatalog,
  client: ILlmClient,
): Promise<IRunFile> {
  const response = await client.generate(buildRequest(deck, pool, catalog));
  const usage = response.usage;

  if (response.stopReason === 'refusal' || response.stopReason === 'max_tokens') {
    return { deck: deck.deck, candidate: 'llm', status: 'failed', stopReason: response.stopReason, usage };
  }

  const ranking = parseRanking(response.text);
  if (ranking === null) {
    return { deck: deck.deck, candidate: 'llm', status: 'failed', error: 'the response was not the requested JSON ranking', usage };
  }

  const run = toRunFile(deck, pool, 'llm', ranking.map((r) => r.card), { usage });
  if (run.status !== 'ok' || !run.top10) return run;
  const reasons = Object.fromEntries(
    run.top10.map((id) => [id, ranking.find((r) => r.card === id)?.reason ?? '']),
  );
  return { ...run, reasons };
}

export function missingKeyMessage(): string {
  return 'ANTHROPIC_API_KEY is not set: export it in your own shell, the key is never written to a file';
}

/** Builds the client only when the key is present, so no request can leave without one. */
export function createLlmClientFromEnv(
  env: NodeJS.ProcessEnv,
  factory: () => ILlmClient,
): ILlmClient | null {
  const key = env['ANTHROPIC_API_KEY'];
  return key === undefined || key.trim() === '' ? null : factory();
}

export async function dryRunLlm(
  decks: readonly IDeckFile[],
  readPool: (deck: string) => IPoolFile,
  catalog: ICatalog,
  client: ILlmClient,
): Promise<string[]> {
  const lines: string[] = [];
  for (const deck of decks) {
    const tokens = await client.countTokens(buildRequest(deck, readPool(deck.deck), catalog));
    lines.push(`${deck.deck} ${deck.name}: ${tokens} input tokens`);
  }
  return lines;
}
