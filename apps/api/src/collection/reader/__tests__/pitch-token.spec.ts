import { readPitchToken } from '../pitch-token';

describe('pitch token reader', () => {
  it.each([
    ['(Red)', 1, false],
    ['red', 1, false],
    ['(Yellow)', 2, false],
    ['(Blue)', 3, false],
    ['vermelho', 1, false],
    ['Amarelo', 2, false],
    ['azul', 3, false],
    ['(1)', 1, true],
    ['(2)', 2, true],
    ['(3)', 3, true],
  ])('reads pitch in English, Portuguese and as a number: %s', (token, pitch, numeric) => {
    const read = readPitchToken(token);

    expect(read?.pitch).toBe(pitch);
    expect(read?.note !== undefined).toBe(numeric);
  });

  it('says how a number was read', () => {
    expect(readPitchToken('(3)')?.note).toBe('"(3)" lido como Azul');
  });

  it('reads nothing from a word that is not a color', () => {
    expect(readPitchToken('(4)')).toBeNull();
    expect(readPitchToken('verde')).toBeNull();
  });
});
