import { readFileSync } from 'fs';
import { catalog } from '@rathe-arsenal/engine';
import { callGemini, GEMINI_MODEL, parseThinkingLevel, TGeminiFetch } from './gemini-client';
import { buildRecommendationPool, buildRecommendationPrompt, IDeckList } from './recommendation-prompt';
import { selectRecommendations } from './validate-answer';

const DEFAULT_PROBE_TIMEOUT_MS = 290_000;

interface ISpikeDeckFile {
  readonly hero: string;
  readonly format: string;
  readonly mainboard: readonly { readonly card: string; readonly quantity: number }[];
}

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

/**
 * Sends one production-shaped recommendation request for a saved deck and reports how long Gemini took.
 * Usage: node dist/recommendations/probe-gemini.js <deck.json> [--thinking low|medium|high] [--timeout-ms 290000]
 * The key is read from GEMINI_API_KEY and never printed.
 */
async function main(): Promise<void> {
  const deckPath = process.argv[2];
  const apiKey = process.env['GEMINI_API_KEY']?.trim();
  if (!deckPath || !apiKey) {
    console.error('usage: GEMINI_API_KEY=... node dist/recommendations/probe-gemini.js <deck.json> [--thinking low|medium|high]');
    process.exit(1);
  }
  const file = JSON.parse(readFileSync(deckPath, 'utf8')) as ISpikeDeckFile;
  const deck: IDeckList = {
    heroIdentifier: file.hero,
    format: file.format,
    cards: [
      { cardIdentifier: file.hero, slot: 'hero', quantity: 1 },
      ...file.mainboard.map((entry) => ({ cardIdentifier: entry.card, slot: 'mainboard', quantity: entry.quantity })),
    ],
  };
  const heroCard = catalog.getCard(file.hero);
  const pool = buildRecommendationPool(deck, heroCard, new Set(), catalog);
  const prompt = buildRecommendationPrompt(deck, heroCard, pool, catalog);
  const thinkingLevel = parseThinkingLevel(flag('thinking'));
  const timeoutMs = Number(flag('timeout-ms') ?? DEFAULT_PROBE_TIMEOUT_MS);

  console.log(
    JSON.stringify({ model: GEMINI_MODEL, hero: file.hero, poolSize: pool.length, promptChars: prompt.system.length + prompt.prompt.length, thinkingLevel: thinkingLevel ?? 'default', timeoutMs }),
  );
  const startedAt = Date.now();
  const outcome = await callGemini(apiKey, prompt, fetch as unknown as TGeminiFetch, { thinkingLevel, timeoutMs });
  const elapsedMs = Date.now() - startedAt;

  if (outcome.kind !== 'answer') {
    console.log(JSON.stringify({ elapsedMs, ...outcome }));
    process.exit(2);
  }
  const { kept, dropped } = selectRecommendations(outcome.entries, new Set(pool.map((card) => card.cardIdentifier)), deck.cards, catalog);
  console.log(JSON.stringify({ elapsedMs, kind: outcome.kind, usage: outcome.usage, entries: outcome.entries.length, kept: kept.length, dropped }));
  for (const entry of kept.slice(0, 5)) console.log(`${entry.rank}. ${entry.cardIdentifier} [${entry.strength}] cut=${entry.cutCardIdentifier ?? '-'} - ${entry.reason}`);
}

void main();
