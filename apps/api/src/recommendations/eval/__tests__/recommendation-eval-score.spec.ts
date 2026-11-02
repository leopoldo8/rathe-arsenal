import { rankedPicks, scoreRun, summarizeCard } from '../recommendation-eval-score';

describe('recommendation eval scoring', () => {
  it('keeps the model order, drops repeats and cards outside the pool, and never cuts at the stored count', () => {
    const pool = new Set(Array.from({ length: 30 }, (_, index) => `card-${index}`));
    const entries = [{ card: 'card-0' }, { card: 'not-in-pool' }, { card: 'card-0' }, ...Array.from({ length: 24 }, (_, index) => ({ card: `card-${index + 1}` }))];

    const picks = rankedPicks(entries, pool);

    expect(picks).toHaveLength(25);
    expect(picks.slice(0, 3)).toEqual(['card-0', 'card-1', 'card-2']);
    expect(picks[24]).toBe('card-24');
  });

  it('ranks each expected card from 1 and counts the ones inside the top N', () => {
    const picks = ['a', 'b', 'berserk-yellow', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'apex-bonebreaker'];

    const score = scoreRun(['berserk-yellow', 'apex-bonebreaker', 'missing'], picks);

    expect(score.ranks).toEqual({ 'berserk-yellow': 3, 'apex-bonebreaker': 11, missing: null });
    expect(score.hits).toBe(1);
    expect(scoreRun(['apex-bonebreaker'], picks, 11).hits).toBe(1);
  });

  it('summarizes a card across runs, an unranked run counting as worse than any rank', () => {
    const scores = [3, 12, null, 7].map((rank) => ({ ranks: { berserk: rank }, hits: 0 }));

    const summary = summarizeCard('berserk', scores);

    expect(summary.hitRate).toEqual({ 5: 0.25, 10: 0.5, 25: 0.75 });
    expect(summary.medianRank).toBe(7);
    expect(summary.ranks).toEqual([3, 12, null, 7]);
    expect(summarizeCard('berserk', [null, null, 4].map((rank) => ({ ranks: { berserk: rank }, hits: 0 }))).medianRank).toBeNull();
  });
});
