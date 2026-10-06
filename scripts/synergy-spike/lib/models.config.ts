/**
 * The four language-model candidates, all reached through OpenRouter.
 * Ids, prices and capability flags were read from https://openrouter.ai/api/v1/models
 * on 2026-10-04 (see implementation-notes.md); prices are USD per million tokens.
 * `reasoningEffort` is sent as `reasoning.effort` only where the owner asked for it.
 */
export interface IModelConfig {
  readonly candidate: 'gpt-6.1-sol' | 'gemini-3.8-flash' | 'mimo-v2.6-pro' | 'opus-5.5';
  readonly model: string;
  readonly reasoningEffort?: 'high';
  readonly promptUsdPerMillion: number;
  readonly completionUsdPerMillion: number;
}

export const MODEL_CONFIGS: readonly IModelConfig[] = [
  { candidate: 'gpt-6.1-sol', model: 'openai/gpt-6.1-sol', reasoningEffort: 'high', promptUsdPerMillion: 2, completionUsdPerMillion: 10 },
  { candidate: 'gemini-3.8-flash', model: 'google/gemini-3.8-flash', promptUsdPerMillion: 0.75, completionUsdPerMillion: 3.75 },
  { candidate: 'mimo-v2.6-pro', model: 'xiaomi/mimo-v2.6-pro', promptUsdPerMillion: 0.435, completionUsdPerMillion: 0.87 },
  { candidate: 'opus-5.5', model: 'anthropic/claude-opus-5.5', reasoningEffort: 'high', promptUsdPerMillion: 4, completionUsdPerMillion: 20 },
];

export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export function configFor(candidate: string): IModelConfig | undefined {
  return MODEL_CONFIGS.find((c) => c.candidate === candidate);
}
