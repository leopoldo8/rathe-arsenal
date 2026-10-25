import { describe, it, expect } from 'vitest';
import i18n from '../../../i18n';
import { deckCauseLine } from '../deckVerdictLine';
import type { ILegalityReasonDetail } from '../../../api/decks';

const t = i18n.t.bind(i18n);

function copies(card: string, count: number, limit = 1): ILegalityReasonDetail {
  return { code: 'too_many_copies', params: { card, cardIdentifier: card, pitch: 1, count, limit, format: 'Blitz', legendary: false, restricted: false } };
}
function banned(card: string): ILegalityReasonDetail {
  return { code: 'card_banned', params: { card, cardIdentifier: card, format: 'Blitz' } };
}
function outOfFormat(card: string): ILegalityReasonDetail {
  return { code: 'card_not_in_format', params: { card, cardIdentifier: card, format: 'Blitz' } };
}
const HERO: ILegalityReasonDetail = {
  code: 'hero_not_legal',
  params: { hero: 'Rhinar', format: 'Classic Constructed', allowedFormats: ['Blitz'] },
};
const SIZE: ILegalityReasonDetail = {
  code: 'mainboard_not_exact',
  params: { card: null, count: 31, limit: 40, format: 'Blitz' },
};

const eightAtTwo = Array.from({ length: 8 }, (_, index) => copies(`card-${index}`, 2));

describe('deckCauseLine', () => {
  it('the cause line table', () => {
    const rows: ReadonlyArray<[string, readonly ILegalityReasonDetail[], string | null]> = [
      ['all copy problems at 2', eightAtTwo, '8 cartas com 2 cópias'],
      ['copy problems at mixed counts', [copies('a', 2), copies('b', 3), copies('c', 2)], '3 cartas acima do limite de cópias'],
      ['banned', [banned('a'), banned('b')], '2 cartas banidas'],
      ['out of format', [outOfFormat('a'), outOfFormat('b'), outOfFormat('c')], '3 cartas fora do formato'],
      ['hero', [HERO], 'herói fora do formato'],
      ['three kinds', [...eightAtTwo, banned('x'), HERO], '8 cartas com 2 cópias · 1 carta banida e mais 1'],
      ['one card', [copies('a', 4, 3)], '1 carta com 4 cópias'],
      ['the size is never a rule problem', [SIZE], null],
      ['a size problem beside a rule problem', [SIZE, copies('a', 2)], '1 carta com 2 cópias'],
    ];

    for (const [label, details, expected] of rows) {
      const line = deckCauseLine(details, t);
      expect({ label, line }).toEqual({ label, line: expected });
      expect(line ?? '', label).not.toMatch(/jogar|pronto/i);
    }
  });

  it('says "e mais N" with the count when several kinds are left out', () => {
    const line = deckCauseLine([...eightAtTwo, banned('x'), outOfFormat('y'), HERO], t);

    expect(line).toBe('8 cartas com 2 cópias · 1 carta banida e mais 2');
  });
});
