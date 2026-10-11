export interface IModelPrice {
  readonly model: string;
  readonly from: string;
  readonly inputUsdPerMillion: number;
  readonly outputUsdPerMillion: number;
}

/** List prices; Gemini 3.8 Flash doubles on 2027-01-01 (AD-010). Output includes thinking tokens. */
export const CHAT_MODEL_PRICES: readonly IModelPrice[] = [
  { model: 'gemini-3.8-flash', from: '2026-01-01', inputUsdPerMillion: 0.75, outputUsdPerMillion: 3.75 },
  { model: 'gemini-3.8-flash', from: '2027-01-01', inputUsdPerMillion: 1.5, outputUsdPerMillion: 7.5 },
];

export const CHAT_BUDGET_USD = 5;

export function priceCall(
  model: string,
  usage: { readonly inputTokens: number; readonly outputTokens: number },
  at: Date,
  prices: readonly IModelPrice[] = CHAT_MODEL_PRICES,
): number {
  const inForce = prices
    .filter((price) => price.model === model && new Date(`${price.from}T00:00:00Z`).getTime() <= at.getTime())
    .sort((a, b) => b.from.localeCompare(a.from))[0];
  if (!inForce) throw new Error(`No price for ${model} at ${at.toISOString()}`);
  const cost = (usage.inputTokens * inForce.inputUsdPerMillion + usage.outputTokens * inForce.outputUsdPerMillion) / 1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

export function startOfUtcMonth(at: Date): Date {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
}

export function startOfNextUtcMonth(at: Date): Date {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 1));
}
