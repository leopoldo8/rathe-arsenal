import { bootRecommendationsFixture, EMISSARY, IRecommendationsFixture } from '../../recommendations/__tests__/recommendations-e2e.fixture';

interface IGroup {
  readonly group: string;
  readonly cards: ReadonlyArray<{ readonly cardIdentifier: string }>;
}

describe('alternatives ordered by the latest recommendation run (e2e)', () => {
  let fixture: IRecommendationsFixture;

  beforeAll(async () => {
    fixture = await bootRecommendationsFixture();
  });

  afterAll(async () => {
    await fixture.close();
  });

  it('a done run reorders a group without changing it', async () => {
    const { jwt, deckId } = await fixture.scenario();
    await fixture.clearRuns(deckId);
    const list = async (): Promise<IGroup[]> =>
      (await fixture.get(`/api/decks/${deckId}/alternatives`, jwt).query({ cardIdentifier: EMISSARY, slot: 'mainboard' }).expect(200)).body.groups;

    const before = await list();
    const group = before[0]!;
    const ids = group.cards.map((card) => card.cardIdentifier);
    expect(ids.length).toBeGreaterThanOrEqual(4);
    const last = ids[ids.length - 1]!;
    const second = ids[1]!;
    const listed = new Set(before.flatMap((entry) => entry.cards.map((card) => card.cardIdentifier)));
    const fillers = ['ancestral-harmony-blue', 'arcane-lantern', 'deathmatch-arena', 'authority-of-ataya-blue'].filter((id) => !listed.has(id));
    expect(fillers.length).toBeGreaterThanOrEqual(2);
    await fixture.seedDoneRun(deckId, [{ card: last }, { card: fillers[0]! }, { card: fillers[1]! }, { card: second }], { stale: true });

    const after = await list();

    expect(after.map((entry) => entry.group)).toEqual(before.map((entry) => entry.group));
    for (const [index, entry] of after.entries()) {
      expect([...entry.cards.map((card) => card.cardIdentifier)].sort()).toEqual([...before[index]!.cards.map((card) => card.cardIdentifier)].sort());
    }
    expect(after[0]!.cards.map((card) => card.cardIdentifier)).toEqual([last, second, ...ids.filter((id) => id !== last && id !== second)]);
    for (const [index, entry] of after.slice(1).entries()) {
      const unrelated = entry.cards.filter((card) => card.cardIdentifier !== last && card.cardIdentifier !== second);
      expect(unrelated.map((card) => card.cardIdentifier)).toEqual(
        before[index + 1]!.cards.map((card) => card.cardIdentifier).filter((id) => id !== last && id !== second),
      );
    }
  });
});
