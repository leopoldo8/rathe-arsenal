import { bootRecommendationsFixture, IRecommendationsFixture } from './recommendations-e2e.fixture';

describe('recommendation schema (e2e)', () => {
  let fixture: IRecommendationsFixture;

  beforeAll(async () => {
    fixture = await bootRecommendationsFixture();
  });

  afterAll(async () => {
    await fixture.close();
  });

  it('enforces every one-way constraint', async () => {
    const { deckId, jwt } = await fixture.scenario();
    await fixture.clearRuns(deckId);
    const query = (sql: string, params: unknown[] = []) => fixture.dataSource.query(sql, params);
    const insertRun = (trigger: string, status: string) =>
      query(`INSERT INTO recommendation_run ("trackedDeckId", "trigger", "status", "runAfter") VALUES ($1, $2, $3, now()) RETURNING id`, [deckId, trigger, status]);

    await expect(insertRun('soon', 'pending')).rejects.toThrow(/CHK_recommendation_run_trigger_valid/);
    await expect(insertRun('auto', 'queued')).rejects.toThrow(/CHK_recommendation_run_status_valid/);
    await insertRun('auto', 'pending');
    await expect(insertRun('manual', 'pending')).rejects.toThrow(/IDX_recommendation_run_one_pending/);
    await insertRun('auto', 'running');
    await expect(insertRun('auto', 'running')).rejects.toThrow(/IDX_recommendation_run_one_running/);

    const [{ id: runId }] = await insertRun('manual', 'done');
    const insertRecommendation = (rank: number, strength: string) =>
      query(`INSERT INTO recommendation ("runId", "cardIdentifier", rank, strength, reason) VALUES ($1, 'flex-red', $2, $3, 'r')`, [runId, rank, strength]);
    await expect(insertRecommendation(0, 'consider')).rejects.toThrow(/CHK_recommendation_rank_range/);
    await expect(insertRecommendation(11, 'consider')).rejects.toThrow(/CHK_recommendation_rank_range/);
    await expect(insertRecommendation(1, 'great')).rejects.toThrow(/CHK_recommendation_strength_valid/);
    await insertRecommendation(1, 'consider');
    await expect(insertRecommendation(1, 'consider')).rejects.toThrow(/IDX_recommendation_run_rank/);

    const insertDismissal = () =>
      query(`INSERT INTO recommendation_dismissal ("trackedDeckId", "cardIdentifier") VALUES ($1, 'flex-red')`, [deckId]);
    await insertDismissal();
    await expect(insertDismissal()).rejects.toThrow(/IDX_recommendation_dismissal_deck_card/);

    const [{ userId }] = await query(`SELECT "userId" FROM tracked_deck WHERE id = $1`, [deckId]);
    const insertReplacement = (pickedFrom: string) =>
      query(
        `INSERT INTO card_replacement ("userId", "trackedDeckId", slot, "originalCardIdentifier", "replacementCardIdentifier", quantity, "pickedFrom", status)
         VALUES ($1, $2, 'mainboard', 'flex-red', 'adrenaline-rush-red', 1, $3, 'active')`,
        [userId, deckId, pickedFrom],
      );
    await insertReplacement('recommendation');
    await expect(insertReplacement('synergy')).rejects.toThrow(/CHK_card_replacement_picked_from_valid/);

    await fixture.del(`/api/decks/${deckId}`, jwt).expect(200);
    const counts = await query(
      `SELECT (SELECT count(*)::int FROM recommendation_run WHERE "trackedDeckId" = $1) AS runs,
              (SELECT count(*)::int FROM recommendation WHERE "runId" = $2) AS recommendations,
              (SELECT count(*)::int FROM recommendation_dismissal WHERE "trackedDeckId" = $1) AS dismissals`,
      [deckId, runId],
    );
    expect(counts[0]).toEqual({ runs: 0, recommendations: 0, dismissals: 0 });
  });
});
