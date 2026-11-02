import { catalog } from '@rathe-arsenal/engine';
import { IUsageSignal } from '../../usage-signal';
import { buildEvalScenario, IReferenceDeck } from '../recommendation-eval-scenarios';
import { EVAL_SPECS, IEvalSpec } from '../recommendation-eval-specs';
import { REFERENCE_DECKS } from '../recommendation-eval-reference-decks';
import { applyEvalVariant, usageHoldout } from '../recommendation-eval-variant';

const spec = (id: string): IEvalSpec => EVAL_SPECS.find((candidate) => candidate.id === id)!;
const deck = (id: string, date: string): IReferenceDeck => ({ id, date, placement: null, cards: 'berserk-yellow:3' });

describe('usage holdout', () => {
  it('leaves out every reference deck and, for tournament references, every deck from their period', () => {
    // Arrange
    const references = [deck('01A', '2026-08-01'), deck('01B', '2026-05-10'), deck('01C', '2026-10-01')];

    // Act
    const holdout = usageHoldout(spec('ira-sa-ablation'), references);

    // Assert
    expect(holdout.excludeFabraryUlids).toEqual(['01A', '01B', '01C']);
    expect(holdout.createdBefore?.toISOString()).toBe('2026-05-10T00:00:00.000Z');
  });

  it('only leaves out the decks themselves when the references are community decks, which the tournament table never holds', () => {
    const holdout = usageHoldout(spec('kayo-ll-owner-deck'), [deck('01A', '2025-01-01')]);

    expect(holdout.excludeFabraryUlids).toEqual(['01A']);
    expect(holdout.createdBefore).toBeUndefined();
  });
});

describe('eval variants', () => {
  const kayo = buildEvalScenario(spec('kayo-ll-owner-deck'), REFERENCE_DECKS['kayo-ll-owner-deck']!, catalog);

  it('the baseline keeps the scenario pool and sends no usage', () => {
    const variant = applyEvalVariant(kayo, { dropPitchSiblings: false, usage: null }, catalog);

    expect(variant.pool).toBe(kayo.pool);
    expect(variant.usage).toBeNull();
  });

  it('dropping pitch siblings shrinks the pool but keeps every expected card', () => {
    const variant = applyEvalVariant(kayo, { dropPitchSiblings: true, usage: null }, catalog);
    const ids = new Set(variant.pool.map((card) => card.cardIdentifier));

    expect(variant.pool.length).toBeLessThan(kayo.pool.length);
    expect(ids.has('wrecker-romp-red')).toBe(false);
    for (const card of kayo.expected) expect(ids.has(card.cardIdentifier)).toBe(true);
  });

  it('refuses a variant whose pool loses an expected card, so variants are always scored on the same cards', () => {
    const scenario = { ...kayo, expected: [{ cardIdentifier: 'wrecker-romp-red', inclusion: 1 }] };

    expect(() => applyEvalVariant(scenario, { dropPitchSiblings: true, usage: null }, catalog)).toThrow(/wrecker-romp-red/);
  });

  it('passes the usage signal through to the pool rule and the prompt', () => {
    const usage: IUsageSignal = { decks: 8, shares: new Map([['wrecker-romp-red', 0.75]]) };

    const variant = applyEvalVariant(kayo, { dropPitchSiblings: true, usage }, catalog);

    expect(variant.usage).toBe(usage);
    expect(variant.pool.some((card) => card.cardIdentifier === 'wrecker-romp-red')).toBe(true);
  });

  it('every committed scenario keeps its expected cards when siblings are dropped', () => {
    for (const evalSpec of EVAL_SPECS) {
      const scenario = buildEvalScenario(evalSpec, REFERENCE_DECKS[evalSpec.id]!, catalog);
      expect(() => applyEvalVariant(scenario, { dropPitchSiblings: true, usage: null }, catalog)).not.toThrow();
    }
  });
});
