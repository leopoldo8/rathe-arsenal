import type { ICatalog, ICatalogCard } from '../../../packages/engine/src';
import { OPENROUTER_URL, type IModelConfig } from './models.config';
import { toRunFile } from './run-file';
import type { IDeckFile, IPoolFile, IRunFile } from './types';

/** Reasoning shares this budget with the answer on most providers, so it is far above the answer's ~2,000 tokens. */
export const LLM_MAX_TOKENS = 32000;
export const LLM_ASK_COUNT = 25;
const CHARS_PER_TOKEN = 4;

export interface ILlmRequest {
  readonly config: IModelConfig;
  readonly maxTokens: number;
  readonly system: string;
  readonly prompt: string;
}

export interface ILlmResponse {
  readonly text: string;
  readonly finishReason: string | null;
  readonly refusal: string | null;
  readonly usage: {
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly reasoningTokens?: number;
    readonly costUsd?: number;
  };
}

export interface ILlmClient {
  generate(request: ILlmRequest): Promise<ILlmResponse>;
}

export type TFetch = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

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

export function buildRequest(config: IModelConfig, deck: IDeckFile, pool: IPoolFile, catalog: ICatalog): ILlmRequest {
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
  return { config, maxTokens: LLM_MAX_TOKENS, system: SYSTEM_PROMPT, prompt };
}

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

/**
 * Body of POST /api/v1/chat/completions. Shape from
 * https://openrouter.ai/docs/guides/features/structured-outputs (response_format json_schema),
 * https://openrouter.ai/docs/guides/best-practices/reasoning-tokens (reasoning.effort) and
 * https://openrouter.ai/docs/api/api-reference/chat-completion (provider.require_parameters).
 */
export function buildBody(request: ILlmRequest): Record<string, unknown> {
  return {
    model: request.config.model,
    max_tokens: request.maxTokens,
    messages: [
      { role: 'system', content: request.system },
      { role: 'user', content: request.prompt },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'ranking', strict: true, schema: RANKING_SCHEMA },
    },
    provider: { require_parameters: true },
    ...(request.config.reasoningEffort ? { reasoning: { effort: request.config.reasoningEffort } } : {}),
  };
}

interface IChatCompletion {
  choices?: { finish_reason?: string | null; message?: { content?: string | null; refusal?: string | null } }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    cost?: number;
    completion_tokens_details?: { reasoning_tokens?: number };
  };
  error?: { message?: string };
}

/** The key is only ever an argument; it is sent in the Authorization header and never stored. */
export function createOpenRouterClient(apiKey: string, fetchImpl: TFetch): ILlmClient {
  return {
    async generate(request) {
      const response = await fetchImpl(OPENROUTER_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(buildBody(request)),
      });
      const json = (await response.json()) as IChatCompletion;
      if (!response.ok || json.error) {
        throw new Error(`OpenRouter answered ${response.status}: ${json.error?.message ?? 'no error message'}`);
      }
      const choice = json.choices?.[0];
      const reasoningTokens = json.usage?.completion_tokens_details?.reasoning_tokens;
      return {
        text: choice?.message?.content ?? '',
        finishReason: choice?.finish_reason ?? null,
        refusal: choice?.message?.refusal ?? null,
        usage: {
          inputTokens: json.usage?.prompt_tokens ?? 0,
          outputTokens: json.usage?.completion_tokens ?? 0,
          ...(reasoningTokens === undefined ? {} : { reasoningTokens }),
          ...(json.usage?.cost === undefined ? {} : { costUsd: json.usage.cost }),
        },
      };
    },
  };
}

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

const FAILING_FINISH_REASONS = new Set(['length', 'content_filter', 'error']);

/** One request for one deck. A refusal, a truncation or unparseable JSON is recorded and never retried. */
export async function runLlmDeck(
  config: IModelConfig,
  deck: IDeckFile,
  pool: IPoolFile,
  catalog: ICatalog,
  client: ILlmClient,
): Promise<IRunFile> {
  const candidate = config.candidate;
  const response = await client.generate(buildRequest(config, deck, pool, catalog));
  const usage = response.usage;

  if (response.refusal) {
    return { deck: deck.deck, candidate, status: 'failed', stopReason: 'refusal', usage };
  }
  if (response.finishReason !== null && FAILING_FINISH_REASONS.has(response.finishReason)) {
    return { deck: deck.deck, candidate, status: 'failed', stopReason: response.finishReason, usage };
  }

  const ranking = parseRanking(response.text);
  if (ranking === null) {
    return { deck: deck.deck, candidate, status: 'failed', error: 'the response was not the requested JSON ranking', usage };
  }

  const run = toRunFile(deck, pool, candidate, ranking.map((r) => r.card), { usage });
  if (run.status !== 'ok' || !run.top10) return run;
  const reasons = Object.fromEntries(
    run.top10.map((id) => [id, ranking.find((r) => r.card === id)?.reason ?? '']),
  );
  return { ...run, reasons };
}

export function missingKeyMessage(): string {
  return 'OPENROUTER_API_KEY is not set: export it in your own shell, the key is never written to a file';
}

/** Returns the key only when present, so no request can be built without one. */
export function readApiKey(env: NodeJS.ProcessEnv): string | null {
  const key = env['OPENROUTER_API_KEY'];
  return key === undefined || key.trim() === '' ? null : key;
}

/** The client exists only when the key does, so a missing key can never produce a request. */
export function resolveLlmClient(env: NodeJS.ProcessEnv, fetchImpl: TFetch): ILlmClient | null {
  const apiKey = readApiKey(env);
  return apiKey === null ? null : createOpenRouterClient(apiKey, fetchImpl);
}

/**
 * OpenRouter has no token-count endpoint (https://openrouter.ai/api/v1/messages/count_tokens answers 404 and the
 * docs index lists none), so the dry run estimates locally at 4 characters per token and calls nothing.
 */
export function dryRunLlm(
  configs: readonly IModelConfig[],
  decks: readonly IDeckFile[],
  readPool: (deck: string) => IPoolFile,
  catalog: ICatalog,
): string[] {
  const lines = ['estimated locally at 4 characters per token; no request was sent (OpenRouter has no token-count endpoint)'];
  for (const config of configs) {
    for (const deck of decks) {
      const request = buildRequest(config, deck, readPool(deck.deck), catalog);
      const tokens = Math.ceil((request.system.length + request.prompt.length) / CHARS_PER_TOKEN);
      const ceilingUsd = (tokens * config.promptUsdPerMillion + request.maxTokens * config.completionUsdPerMillion) / 1e6;
      lines.push(`${config.candidate} ${deck.deck} ${deck.name}: about ${tokens} input tokens, at most ${ceilingUsd.toFixed(2)} USD`);
    }
  }
  return lines;
}
