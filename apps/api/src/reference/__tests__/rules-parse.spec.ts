import { readFileSync } from 'fs';
import { join } from 'path';
import { parseRulesIndex } from '../rules-parse';

const FIXTURE = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'rules-search-index.json'), 'utf8'));

describe('rules index parsing', () => {
  it('one entry per numbered rule and glossary term, cr only', () => {
    const entries = parseRulesIndex(FIXTURE);
    const byNumber = new Map(entries.map((entry) => [entry.ruleNumber, entry]));

    const players = byNumber.get('1.1.1a');
    expect(players).toEqual(
      expect.objectContaining({
        sectionNumber: '1.1',
        sectionTitle: 'Players',
        url: 'https://rules.fabtcg.com/en/cr/01-game-concepts/#cr1.1',
      }),
    );
    expect(players!.text.startsWith('1.1.1a To participate')).toBe(true);
    expect(byNumber.get('Glossary: Ability')?.text).toMatch(/^An object property/);
    expect(entries.filter((entry) => !entry.url.startsWith('https://rules.fabtcg.com/en/cr/'))).toEqual([]);
    expect(entries.filter((entry) => /<[a-z/]/i.test(entry.text) || entry.text.includes('§'))).toEqual([]);
    expect(new Set(entries.map((entry) => entry.ruleNumber)).size).toBe(entries.length);
  });
});
