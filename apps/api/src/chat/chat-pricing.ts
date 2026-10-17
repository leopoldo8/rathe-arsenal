export interface IModelPrice {
  readonly model: string;
  readonly from: string;
  readonly inputUsdPerMillion: number;
  readonly cachedInputUsdPerMillion: number;
  readonly outputUsdPerMillion: number;
}

/**
 * List prices; Gemini 3.8 Flash doubles on 2027-01-01 (AD-010). Output includes thinking tokens.
 * OpenRouter reports what each call cost, so its rows only price a call whose answer left the cost out.
 */
export const CHAT_MODEL_PRICES: readonly IModelPrice[] = [
  { model: 'gemini-3.8-flash', from: '2026-01-01', inputUsdPerMillion: 0.75, cachedInputUsdPerMillion: 0.075, outputUsdPerMillion: 3.75 },
  { model: 'gemini-3.8-flash', from: '2027-01-01', inputUsdPerMillion: 1.5, cachedInputUsdPerMillion: 0.15, outputUsdPerMillion: 7.5 },
  { model: 'google/gemini-3.8-flash', from: '2026-01-01', inputUsdPerMillion: 0.75, cachedInputUsdPerMillion: 0.075, outputUsdPerMillion: 3.75 },
  { model: 'google/gemini-3.5-flash-lite', from: '2026-01-01', inputUsdPerMillion: 0.3, cachedInputUsdPerMillion: 0.03, outputUsdPerMillion: 2.5 },
  { model: 'google/gemini-3.1-flash-lite', from: '2026-01-01', inputUsdPerMillion: 0.25, cachedInputUsdPerMillion: 0.025, outputUsdPerMillion: 1.5 },
  { model: 'anthropic/claude-haiku-5.5', from: '2026-01-01', inputUsdPerMillion: 0.1, cachedInputUsdPerMillion: 0.01, outputUsdPerMillion: 0.5 },
  { model: 'openai/gpt-6-luna', from: '2026-01-01', inputUsdPerMillion: 0.1, cachedInputUsdPerMillion: 0.01, outputUsdPerMillion: 0.5 },
];

export const CHAT_BUDGET_USD = 5;

export function priceCall(
  model: string,
  usage: { readonly inputTokens: number; readonly outputTokens: number; readonly cachedInputTokens?: number; readonly costUsd?: number },
  at: Date,
  prices: readonly IModelPrice[] = CHAT_MODEL_PRICES,
): number {
  const inForce = prices
    .filter((price) => price.model === model && new Date(`${price.from}T00:00:00Z`).getTime() <= at.getTime())
    .sort((a, b) => b.from.localeCompare(a.from))[0];
  if (usage.costUsd !== undefined) return usage.costUsd;
  if (!inForce) throw new Error(`No price for ${model} at ${at.toISOString()}`);
  const cached = Math.min(usage.cachedInputTokens ?? 0, usage.inputTokens);
  const cost =
    ((usage.inputTokens - cached) * inForce.inputUsdPerMillion + cached * inForce.cachedInputUsdPerMillion + usage.outputTokens * inForce.outputUsdPerMillion) /
    1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

export function startOfUtcMonth(at: Date): Date {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
}

export function startOfNextUtcMonth(at: Date): Date {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 1));
}
