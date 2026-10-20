import { formatBrl, formatBrlShort } from '../format-brl';

describe('formatBrl', () => {
  it.each([
    [0, 'R$ 0,00'],
    [5, 'R$ 0,05'],
    [600, 'R$ 6,00'],
    [42000, 'R$ 420,00'],
    [123456, 'R$ 1.234,56'],
    [100000000, 'R$ 1.000.000,00'],
  ])('writes %i cents as %s', (cents, text) => {
    expect(formatBrl(cents)).toBe(text);
  });
});

describe('formatBrlShort', () => {
  it('drops the cents of a whole amount and keeps them otherwise', () => {
    expect(formatBrlShort(12000)).toBe('R$ 120');
    expect(formatBrlShort(12050)).toBe('R$ 120,50');
    expect(formatBrlShort(123400)).toBe('R$ 1.234');
  });
});
