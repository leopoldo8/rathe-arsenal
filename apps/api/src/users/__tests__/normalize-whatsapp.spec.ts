import { normalizeWhatsappNumber } from '../normalize-whatsapp';

describe('normalizeWhatsappNumber', () => {
  it.each([
    ['(51) 99999-0000', '5551999990000'],
    ['5133334444', '555133334444'],
    ['+55 51 99999-0000', '5551999990000'],
    ['+44 20 7946 0958', '442079460958'],
  ])('normalizes %s', (raw, expected) => {
    expect(normalizeWhatsappNumber(raw)).toBe(expected);
  });

  it.each(['', 'abc', '123456789', '1234567890123456'])('rejects %p', (raw) => {
    expect(normalizeWhatsappNumber(raw)).toBeNull();
  });
});
