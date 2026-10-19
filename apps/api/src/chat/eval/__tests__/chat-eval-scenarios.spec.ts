import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EVAL_DECKS, EVAL_SCENARIOS, IEvalOutcome } from '../chat-eval-scenarios';

const WEB_CHAT_COPY = readFileSync(join(__dirname, '../../../../../web/src/i18n/locales/pt-BR/chat.ts'), 'utf8');

function copy(key: string): string {
  return new RegExp(`${key}: '([^']+)'`).exec(WEB_CHAT_COPY)![1]!;
}

describe('chat eval scenarios', () => {
  it('ask the ready questions exactly as the pt-BR screens show them', () => {
    const questions = EVAL_SCENARIOS.map((scenario) => scenario.question);
    const tile = [
      ...EVAL_DECKS.map((deck) => copy('readyHero').replace('{{hero}}', deck.hero).replace('Como outras pessoas montam', 'Como outros jogam')),
      copy('readySwap'),
      copy('readyMissing'),
    ];

    expect(questions).toEqual(expect.arrayContaining([copy('readyNextHero'), copy('readyTriggers'), ...tile]));
    expect(questions).toContain(copy('readyHero').replace('{{hero}}', 'Kano'));
    expect(new Set(EVAL_SCENARIOS.map((scenario) => scenario.id)).size).toBe(EVAL_SCENARIOS.length);
  });
});

describe('chat eval checks', () => {
  const scenario = (id: string) => EVAL_SCENARIOS.find((entry) => entry.id === id)!;
  const outcome = (overrides: Partial<IEvalOutcome> = {}): IEvalOutcome => ({ text: '', toolCalls: [], swaps: [], ...overrides });

  it('a swap for Lace with Bloodrot fails when it changes the role and passes when it keeps it', () => {
    const check = scenario('swap-keeps-role-azalea').check!;

    expect(check(outcome({ swaps: [{ original: 'lace-with-bloodrot-red', replacement: 'widowmaker-yellow' }] }))).toContain('widowmaker-yellow');
    expect(check(outcome({ swaps: [{ original: 'lace-with-bloodrot-red', replacement: 'fire-in-the-hole-red' }] }))).toBeNull();
    expect(check(outcome())).toBeNull();
  });

  it('a swap that costs more fails unless the answer talks about cost', () => {
    const check = scenario('swap-cost-azalea').check!;
    const pricier = [{ original: 'lace-with-bloodrot-red', replacement: 'fletch-a-red-tail-red' }];

    expect(check(outcome({ swaps: pricier, text: 'Fletch a Red Tail dá +4.' }))).toContain('cost');
    expect(check(outcome({ swaps: pricier, text: 'Ela tem custo 1, contra 0 da Lace.' }))).toBeNull();
    expect(check(outcome({ swaps: [{ original: 'lace-with-bloodrot-red', replacement: 'toxicity-red' }], text: 'Toxicity.' }))).toBeNull();
  });

  it('asked for more arrows, every proposed card must be an arrow and the answer must talk about arrows', () => {
    const check = scenario('swap-role-change-azalea').check!;

    expect(check(outcome({ text: 'Troque por flechas.', swaps: [{ original: 'lace-with-bloodrot-red', replacement: 'widowmaker-yellow' }] }))).toBeNull();
    expect(check(outcome({ text: 'Troque por flechas.', swaps: [{ original: 'lace-with-bloodrot-red', replacement: 'toxicity-red' }] }))).toContain('toxicity-red');
    expect(check(outcome({ text: 'Nada a fazer.' }))).not.toBeNull();
  });

  it("Quick Clicks is never proposed for a deck without Nimblism", () => {
    const check = scenario('swap-dead-card-azalea').check!;

    expect(check(outcome({ swaps: [{ original: 'boltn-boots', replacement: 'quick-clicks' }] }))).toContain('quick-clicks');
    expect(check(outcome())).toBeNull();
  });

  it("comparing the deck's makeup needs the deck's own counts and the other decks' average", () => {
    const check = scenario('makeup-compare-azalea').check!;

    expect(check(outcome({ text: 'Sua proporção parece bem próxima das outras listas.' }))).not.toBeNull();
    expect(check(outcome({ text: 'Você tem 22 flechas e 16 buffs; a média das 5 listas é 19,2 flechas e 18,8 buffs.' }))).toBeNull();
  });

  it('saying the user already has cards needs a collection or deck lookup in that answer', () => {
    const check = scenario('tile-tournaments-azalea').check!;

    expect(check(outcome({ text: 'Você já tem boa parte desse núcleo.' }))).not.toBeNull();
    expect(check(outcome({ text: 'Você já tem boa parte desse núcleo.', toolCalls: ['get_collection({})'] }))).toBeNull();
    expect(check(outcome({ text: 'Há 5 listas regulares.' }))).toBeNull();
  });
});
