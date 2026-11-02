import { catalog } from '@rathe-arsenal/engine';
import { REFERENCE_DECKS } from '../recommendation-eval-reference-decks';
import {
  buildEvalScenario,
  formatDeckCards,
  inclusionRates,
  IReferenceDeck,
  MIN_REFERENCE_DECKS,
  parseDeckCards,
  pickAblationDeck,
  STAPLE_INCLUSION,
  withExpectedFrom,
} from '../recommendation-eval-scenarios';
import { EVAL_SPECS, IEvalSpec } from '../recommendation-eval-specs';

const KAYO_LL: Omit<IEvalSpec, 'input'> = {
  id: 'kayo-test',
  heroIdentifier: 'kayo-armed-and-dangerous',
  format: 'Living Legend',
  reference: { source: 'community', maxAgeDays: 365, maxDecks: 40 },
};

function referenceDeck(id: string, cards: string, overrides: Partial<IReferenceDeck> = {}): IReferenceDeck {
  return { id, date: '2026-10-01', placement: null, cards, ...overrides };
}

/** Ten decks: every one plays Berserk and Mandible Claw, nine play Pulping, four play Wild Ride. */
function kayoDecks(): IReferenceDeck[] {
  return Array.from({ length: 10 }, (_, index) =>
    referenceDeck(
      `deck-${index}`,
      [
        'berserk-yellow:3',
        'mandible-claw:1',
        index < 9 ? 'pulping-red:3' : 'savage-feast-red:3',
        index < 4 ? 'wild-ride-red:3' : 'beast-within-yellow:3',
      ].join(' '),
      { date: `2026-10-${String(index + 10)}`, placement: index === 3 || index === 6 ? 1 : index + 2 },
    ),
  );
}

describe('recommendation eval scenarios', () => {
  it('reads identifier:quantity pairs, adding repeats, and writes them back sorted', () => {
    const cards = parseDeckCards('pulping-red:2  berserk-yellow:3 pulping-red:1');

    expect([...cards.entries()]).toEqual([
      ['pulping-red', 3],
      ['berserk-yellow', 3],
    ]);
    expect(formatDeckCards(cards)).toBe('berserk-yellow:3 pulping-red:3');
  });

  it('refuses a pair without a positive whole quantity', () => {
    for (const bad of ['pulping-red', 'pulping-red:0', 'pulping-red:x', ':3', 'pulping-red:1.5']) {
      expect(() => parseDeckCards(bad)).toThrow(/identifier:quantity/);
    }
  });

  it('measures inclusion as the share of decks that play a card at all, whatever the copies', () => {
    const rates = inclusionRates([referenceDeck('a', 'berserk-yellow:3 pulping-red:1'), referenceDeck('b', 'berserk-yellow:1')]);

    expect(rates.get('berserk-yellow')).toBe(1);
    expect(rates.get('pulping-red')).toBe(0.5);
  });

  it('ablates the best placed deck, the most recent one on a tie', () => {
    expect(pickAblationDeck(kayoDecks()).id).toBe('deck-6');
    expect(pickAblationDeck([referenceDeck('x', 'pulping-red:1'), referenceDeck('y', 'pulping-red:1', { date: '2026-10-02' })]).id).toBe('y');
  });

  it('expects the staples a fixed deck lacks, never a card it plays, a weapon or a card below the bar', () => {
    const spec: IEvalSpec = { ...KAYO_LL, input: { kind: 'deck', provenance: 'test', cards: 'pulping-red:3 savage-feast-red:3' } };

    const scenario = buildEvalScenario(spec, kayoDecks(), catalog);

    // pulping-red is a staple the deck already plays; mandible-claw is a weapon, never in the pool; wild-ride-red is in 40%.
    expect(scenario.expected).toEqual([{ cardIdentifier: 'berserk-yellow', inclusion: 1 }]);
    expect(scenario.deck.cards[0]).toEqual({ cardIdentifier: 'kayo-armed-and-dangerous', slot: 'hero', quantity: 1 });
    expect(scenario.referenceDecks).toBe(10);
  });

  it('removes every copy of the most played staples from the ablated deck and leaves its own vote out', () => {
    const spec: IEvalSpec = { ...KAYO_LL, input: { kind: 'ablation', remove: 1 } };

    const scenario = buildEvalScenario(spec, kayoDecks(), catalog);
    const deckIdentifiers = scenario.deck.cards.map((card) => card.cardIdentifier);

    expect(scenario.inputFrom).toBe('reference deck deck-6');
    expect(scenario.referenceDecks).toBe(9);
    expect(scenario.expected).toEqual([{ cardIdentifier: 'berserk-yellow', inclusion: 1 }]);
    expect(deckIdentifiers).not.toContain('berserk-yellow');
    expect(deckIdentifiers).toEqual(expect.arrayContaining(['pulping-red', 'beast-within-yellow', 'mandible-claw']));
    expect(scenario.deck.cards.find((card) => card.cardIdentifier === 'mandible-claw')?.slot).toBe('weapon');
    expect(scenario.pool.some((card) => card.cardIdentifier === 'berserk-yellow')).toBe(true);
  });

  it('recomputes the expected cards of a fixed deck from other decks, for a fold that held its signal decks apart', () => {
    // Arrange
    const spec: IEvalSpec = { ...KAYO_LL, input: { kind: 'deck', provenance: 'test', cards: 'pulping-red:3 savage-feast-red:3' } };
    const scenario = buildEvalScenario(spec, kayoDecks(), catalog);
    const fold = kayoDecks().slice(0, 4);

    // Act
    const folded = withExpectedFrom(scenario, 'kayo-test:fold-1', fold);

    // Assert
    expect(folded.id).toBe('kayo-test:fold-1');
    expect(folded.referenceDecks).toBe(4);
    expect(folded.expected).toEqual([
      { cardIdentifier: 'berserk-yellow', inclusion: 1 },
      { cardIdentifier: 'wild-ride-red', inclusion: 1 },
    ]);
    expect(folded.deck).toBe(scenario.deck);
    expect(folded.pool).toBe(scenario.pool);
  });

  it('refuses a scenario with too few reference decks to trust an inclusion rate', () => {
    const spec: IEvalSpec = { ...KAYO_LL, input: { kind: 'ablation', remove: 1 } };

    expect(() => buildEvalScenario(spec, kayoDecks().slice(0, MIN_REFERENCE_DECKS - 1), catalog)).toThrow(/reference decks/);
  });

  describe('committed scenarios', () => {
    const scenarios = EVAL_SPECS.map((spec) => buildEvalScenario(spec, REFERENCE_DECKS[spec.id] ?? [], catalog));

    // Catches a ban, a rotation or a stale snapshot before anyone pays for a model call.
    it.each(scenarios.map((scenario) => [scenario.id, scenario]))('%s expects staples the candidate pool can offer', (_id, scenario) => {
      const pool = new Set(scenario.pool.map((card) => card.cardIdentifier));
      const inDeck = new Set(scenario.deck.cards.map((card) => card.cardIdentifier));

      expect(scenario.expected.length).toBeGreaterThan(0);
      for (const card of scenario.expected) {
        expect(pool.has(card.cardIdentifier)).toBe(true);
        expect(inDeck.has(card.cardIdentifier)).toBe(false);
        expect(card.inclusion).toBeGreaterThanOrEqual(STAPLE_INCLUSION);
      }
    });

    it('expects Berserk for the owner Kayo Living Legend deck', () => {
      const kayo = scenarios.find((scenario) => scenario.id === 'kayo-ll-owner-deck')!;

      expect(kayo.expected.map((card) => card.cardIdentifier)).toContain('berserk-yellow');
    });

    it('has a unique id and a snapshot for every spec', () => {
      expect(new Set(EVAL_SPECS.map((spec) => spec.id)).size).toBe(EVAL_SPECS.length);
      expect(Object.keys(REFERENCE_DECKS).sort()).toEqual(EVAL_SPECS.map((spec) => spec.id).sort());
    });
  });
});
