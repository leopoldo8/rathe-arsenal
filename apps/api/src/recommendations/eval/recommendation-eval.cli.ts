import { writeFileSync } from 'node:fs';
import { catalog } from '@rathe-arsenal/engine';
import { parseThinkingLevel, TGeminiFetch, TGeminiThinkingLevel } from '../gemini-client';
import { callOpenRouterRecommendation } from '../openrouter-recommendation-client';
import { buildRecommendationPrompt } from '../recommendation-prompt';
import { REFERENCE_DECKS, REFERENCE_SNAPSHOT_DATE } from './recommendation-eval-reference-decks';
import { buildEvalScenario, IEvalScenario, STAPLE_INCLUSION } from './recommendation-eval-scenarios';
import { EVAL_TOP_N, IRunScore, rankedPicks, scoreRun, summarizeCard } from './recommendation-eval-score';
import { EVAL_SPECS } from './recommendation-eval-specs';

/** The model the recommendation worker runs in production (RECOMMENDATION_OPENROUTER_MODEL). */
export const DEFAULT_EVAL_MODEL = 'openai/gpt-6-luna';
export const DEFAULT_EVAL_MAX_USD = 1;
const PICKS_SHOWN = 10;

export interface IRecommendationEvalOptions {
  readonly runs: number;
  readonly concurrency: number;
  readonly only: readonly string[];
  readonly model: string;
  readonly maxUsd: number;
  readonly out: string;
  /** Reasoning effort sent to the model; undefined, like production, sends none. */
  readonly effort: TGeminiThinkingLevel | undefined;
}

function positive(flag: string, raw: string | undefined, fallback: number, integer: boolean): number {
  if (raw === undefined) return fallback;
  const value = Number(raw);
  // A value that does not parse would turn `spent >= cap` or a loop bound into a silent no-op.
  if (raw.trim() === '' || !Number.isFinite(value) || value <= 0 || (integer && !Number.isInteger(value))) {
    throw new Error(`${flag} must be a positive ${integer ? 'integer' : 'number'}, got "${raw}"`);
  }
  return value;
}

function readEffort(raw: string | undefined): TGeminiThinkingLevel | undefined {
  if (raw === undefined) return undefined;
  const effort = parseThinkingLevel(raw);
  if (!effort) throw new Error(`--effort must be low, medium or high, got "${raw}"`);
  return effort;
}

export function readEvalOptions(argv: readonly string[]): IRecommendationEvalOptions {
  const value = (flag: string): string | undefined => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  return {
    runs: positive('--runs', value('--runs'), 3, true),
    concurrency: positive('--concurrency', value('--concurrency'), 3, true),
    only: (value('--only') ?? '').split(',').filter(Boolean),
    model: value('--model') ?? DEFAULT_EVAL_MODEL,
    maxUsd: positive('--max-usd', value('--max-usd'), DEFAULT_EVAL_MAX_USD, false),
    out: value('--out') ?? 'recommendation-eval-report',
    effort: readEffort(value('--effort')),
  };
}

export interface IEvalRunResult {
  readonly scenario: string;
  readonly run: number;
  readonly status: string;
  readonly error: string | null;
  readonly ms: number;
  readonly costUsd: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly picks: readonly string[];
  readonly score: IRunScore | null;
}

function percent(share: number): string {
  return `${Math.round(share * 100)}%`;
}

function rankCell(rank: number | null): string {
  return rank === null ? '-' : String(rank);
}

export function renderEvalReport(model: string, scenarios: readonly IEvalScenario[], results: readonly IEvalRunResult[]): string {
  const scored = results.filter((result) => result.score !== null);
  const expectedRuns = scored.reduce((sum, result) => sum + Object.keys(result.score!.ranks).length, 0);
  const hits = scored.reduce((sum, result) => sum + result.score!.hits, 0);
  const spent = results.reduce((sum, result) => sum + result.costUsd, 0);
  const lines = [
    `# Recommendation eval: ${model}`,
    '',
    `Reference decks from Fabrary, snapshot ${REFERENCE_SNAPSHOT_DATE}. Expected cards: played by at least ${percent(STAPLE_INCLUSION)} of a scenario's reference decks, missing from its deck, in its candidate pool.`,
    `${scored.length}/${results.length} runs answered, $${spent.toFixed(4)} spent. Expected cards in the top ${EVAL_TOP_N}: ${hits}/${expectedRuns} (${percent(expectedRuns === 0 ? 0 : hits / expectedRuns)}).`,
    '',
  ];
  for (const scenario of scenarios) {
    const runs = results.filter((result) => result.scenario === scenario.id);
    const scores = runs.flatMap((result) => (result.score ? [result.score] : []));
    lines.push(
      `## ${scenario.id}`,
      '',
      `Deck: ${scenario.inputFrom}. ${scenario.referenceDecks} reference decks, pool of ${scenario.pool.length} cards, ${scores.length}/${runs.length} runs answered.`,
      '',
      '| Expected card | Played by | Top 5 | Top 10 | Top 25 | Median rank | Ranks per run |',
      '| --- | --- | --- | --- | --- | --- | --- |',
      ...scenario.expected.map((card) => {
        const summary = summarizeCard(card.cardIdentifier, scores);
        return `| ${card.cardIdentifier} | ${percent(card.inclusion)} | ${percent(summary.hitRate[5]!)} | ${percent(summary.hitRate[10]!)} | ${percent(summary.hitRate[25]!)} | ${rankCell(summary.medianRank)} | ${summary.ranks.map(rankCell).join(', ')} |`;
      }),
      '',
      ...runs.map((result) =>
        result.score
          ? `- Run ${result.run} (${result.ms} ms, $${result.costUsd.toFixed(4)}): ${result.picks.slice(0, PICKS_SHOWN).join(', ')}`
          : `- Run ${result.run}: ${result.status} ${result.error ?? ''}`,
      ),
      '',
    );
  }
  return lines.join('\n');
}

interface IUsageBody {
  usage?: { cost?: number };
}

/** Passes calls through and adds up the cost OpenRouter reports for each one. */
function costTrackingFetch(costs: number[]): TGeminiFetch {
  return async (url, init) => {
    const response = await fetch(url, init);
    const body = (await response.json().catch(() => null)) as IUsageBody | null;
    costs.push(body?.usage?.cost ?? 0);
    return { ok: response.ok, status: response.status, json: async () => body };
  };
}

async function runOnce(apiKey: string, options: IRecommendationEvalOptions, scenario: IEvalScenario, run: number): Promise<IEvalRunResult> {
  const prompt = buildRecommendationPrompt(scenario.deck, scenario.heroCard, scenario.pool, catalog);
  const costs: number[] = [];
  const startedAt = Date.now();
  const outcome = await callOpenRouterRecommendation(apiKey, options.model, prompt, costTrackingFetch(costs), { thinkingLevel: options.effort });
  const base = { scenario: scenario.id, run, ms: Date.now() - startedAt, costUsd: costs.reduce((sum, cost) => sum + cost, 0) };
  if (outcome.kind !== 'answer') {
    const error = outcome.kind === 'failed' ? `${outcome.code} ${outcome.detail ?? ''}` : `${outcome.code} HTTP ${outcome.status}`;
    return { ...base, status: outcome.kind, error, inputTokens: 0, outputTokens: 0, picks: [], score: null };
  }
  const picks = rankedPicks(outcome.entries, new Set(scenario.pool.map((card) => card.cardIdentifier)));
  const expected = scenario.expected.map((card) => card.cardIdentifier);
  return { ...base, status: 'answered', error: null, ...outcome.usage, picks, score: scoreRun(expected, picks) };
}

/**
 * `recommendations:eval [--model openrouter/id] [--effort low|medium|high] [--runs N] [--concurrency N] [--only id,id] [--max-usd N] [--out path]`:
 * sends each scenario's production prompt to the real model through OpenRouter (OPENROUTER_API_KEY) and scores where
 * the cards that most reference decks play land in its ranking. Paid, so it never runs in CI.
 */
async function main(): Promise<void> {
  let options: IRecommendationEvalOptions;
  try {
    options = readEvalOptions(process.argv.slice(2));
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }
  const apiKey = process.env['OPENROUTER_API_KEY']?.trim();
  if (!apiKey) {
    console.error('recommendations:eval needs OPENROUTER_API_KEY');
    process.exit(1);
  }
  const scenarios = EVAL_SPECS.filter((spec) => options.only.length === 0 || options.only.includes(spec.id)).map((spec) =>
    buildEvalScenario(spec, REFERENCE_DECKS[spec.id] ?? [], catalog),
  );
  const queue = scenarios.flatMap((scenario) => Array.from({ length: options.runs }, (_, index) => ({ scenario, run: index + 1 })));
  const results: IEvalRunResult[] = [];
  const spent = (): number => results.reduce((sum, result) => sum + result.costUsd, 0);
  const worker = async (): Promise<void> => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      if (spent() >= options.maxUsd) {
        console.error(`stopped: $${spent().toFixed(4)} spent, the cap is $${options.maxUsd}`);
        return;
      }
      const result = await runOnce(apiKey, options, next.scenario, next.run);
      results.push(result);
      console.error(`${result.scenario} #${result.run}: ${result.status}${result.score ? `, ${result.score.hits}/${next.scenario.expected.length} in the top ${EVAL_TOP_N}` : ''}`);
    }
  };
  await Promise.all(Array.from({ length: options.concurrency }, worker));
  const ordered = [...results].sort((a, b) => a.scenario.localeCompare(b.scenario) || a.run - b.run);
  writeFileSync(`${options.out}.json`, JSON.stringify({ model: options.model, effort: options.effort ?? null, snapshot: REFERENCE_SNAPSHOT_DATE, results: ordered }, null, 2));
  const label = options.effort ? `${options.model}, effort ${options.effort}` : options.model;
  writeFileSync(`${options.out}.md`, renderEvalReport(label, scenarios, ordered));
  console.error(`report at ${options.out}.md`);
  process.exit(ordered.every((result) => result.score !== null) ? 0 : 1);
}

if (require.main === module) {
  void main();
}
