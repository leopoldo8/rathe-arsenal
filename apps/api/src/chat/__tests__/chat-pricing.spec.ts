import { priceCall } from '../chat-pricing';

describe('chat pricing', () => {
  it('prices a call from the row in force', () => {
    const usage = { inputTokens: 40_000, outputTokens: 1_000 + 3_000 };

    expect(priceCall('gemini-3.8-flash', usage, new Date('2026-10-11T12:00:00Z'))).toBeCloseTo(0.045, 6);
    expect(priceCall('gemini-3.8-flash', usage, new Date('2027-01-02T12:00:00Z'))).toBeCloseTo(0.09, 6);
  });

  it('prices cached input at the cached rate', () => {
    const usage = { inputTokens: 40_000, cachedInputTokens: 30_000, outputTokens: 4_000 };

    // 10k fresh at 0.75, 30k cached at 0.075, 4k out at 3.75 per million.
    expect(priceCall('gemini-3.8-flash', usage, new Date('2026-10-11T12:00:00Z'))).toBeCloseTo(0.02475, 6);
  });

  it('takes the cost the provider reported over the price list', () => {
    const usage = { inputTokens: 40_000, outputTokens: 4_000, costUsd: 0.0061 };

    expect(priceCall('anthropic/claude-haiku-5.5', usage, new Date('2026-10-11T12:00:00Z'))).toBe(0.0061);
    expect(priceCall('unlisted/model', usage, new Date('2026-10-11T12:00:00Z'))).toBe(0.0061);
  });
});
