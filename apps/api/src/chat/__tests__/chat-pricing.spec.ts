import { priceCall } from '../chat-pricing';

describe('chat pricing', () => {
  it('prices a call from the row in force', () => {
    const usage = { inputTokens: 40_000, outputTokens: 1_000 + 3_000 };

    expect(priceCall('gemini-3.8-flash', usage, new Date('2026-10-11T12:00:00Z'))).toBeCloseTo(0.045, 6);
    expect(priceCall('gemini-3.8-flash', usage, new Date('2027-01-02T12:00:00Z'))).toBeCloseTo(0.09, 6);
  });
});
