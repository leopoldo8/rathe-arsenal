import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EVAL_DECKS, EVAL_SCENARIOS } from '../chat-eval-scenarios';

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
