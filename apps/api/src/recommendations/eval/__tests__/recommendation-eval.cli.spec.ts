import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { catalog } from '@rathe-arsenal/engine';
import { buildEvalScenario } from '../recommendation-eval-scenarios';
import { DEFAULT_EVAL_MAX_USD, DEFAULT_EVAL_MODEL, IEvalRunResult, readEvalOptions, renderEvalReport } from '../recommendation-eval.cli';
import { EVAL_SPECS } from '../recommendation-eval-specs';
import { REFERENCE_DECKS } from '../recommendation-eval-reference-decks';

const CI_WORKFLOW = readFileSync(join(__dirname, '../../../../../../.github/workflows/ci.yml'), 'utf8');

describe('recommendation eval CLI', () => {
  it('defaults to the production model, three runs and a one dollar cap', () => {
    expect(readEvalOptions([])).toEqual({ runs: 3, concurrency: 3, only: [], model: DEFAULT_EVAL_MODEL, maxUsd: DEFAULT_EVAL_MAX_USD, out: 'recommendation-eval-report', effort: undefined });
    expect(DEFAULT_EVAL_MODEL).toBe('openai/gpt-6-luna');
    expect(readEvalOptions(['--runs', '5', '--only', 'a,b', '--max-usd', '0.5']).only).toEqual(['a', 'b']);
  });

  it('refuses a cap or a count that is not positive, instead of removing the cap', () => {
    for (const value of ['abc', '', '-1', '0']) {
      expect(() => readEvalOptions(['--max-usd', value])).toThrow(/--max-usd/);
    }
    expect(() => readEvalOptions(['--runs', '1.5'])).toThrow(/--runs/);
    expect(() => readEvalOptions(['--effort', 'max'])).toThrow(/--effort/);
    expect(readEvalOptions(['--effort', 'High']).effort).toBe('high');
  });

  it('never runs in CI, because every run is a paid model call', () => {
    expect(CI_WORKFLOW).not.toContain('recommendations:eval');
    expect(CI_WORKFLOW).not.toContain('recommendation-eval');
  });

  it('reports each expected card with its rank per run and the overall top 10 share', () => {
    const spec = EVAL_SPECS.find((candidate) => candidate.id === 'kayo-ll-owner-deck')!;
    const scenario = buildEvalScenario(spec, REFERENCE_DECKS[spec.id]!, catalog);
    const expected = scenario.expected.map((card) => card.cardIdentifier);
    const answered = (run: number, berserkRank: number | null): IEvalRunResult => ({
      scenario: spec.id,
      run,
      status: 'answered',
      error: null,
      ms: 1000,
      costUsd: 0.01,
      inputTokens: 1,
      outputTokens: 1,
      picks: ['pulping-yellow'],
      score: { ranks: Object.fromEntries(expected.map((card) => [card, card === 'berserk-yellow' ? berserkRank : null])), hits: berserkRank !== null && berserkRank <= 10 ? 1 : 0 },
    });

    const report = renderEvalReport('openai/gpt-6-luna', [scenario], [answered(1, 4), answered(2, null)]);

    expect(report).toContain('| berserk-yellow | 91% | 50% | 50% | 50% | 4 | 4, - |');
    expect(report).toContain(`Expected cards in the top 10: 1/${expected.length * 2}`);
    expect(report).toContain('$0.0200 spent');
  });
});
