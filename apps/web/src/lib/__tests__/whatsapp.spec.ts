import { describe, expect, it } from 'vitest';
import {
  buildWhatsappUrl,
  formatNumberForDisplay,
  formatNumberForField,
  isPlausibleWhatsappNumber,
} from '../whatsapp';

describe('isPlausibleWhatsappNumber', () => {
  it.each(['53 99999-0000', '5399999000', '+55 53 99999-0000', '5553999990000'])('accepts %s', (value) => {
    expect(isPlausibleWhatsappNumber(value)).toBe(true);
  });

  it.each(['', '53 9999', '123456789', '1234567890123456'])('rejects %s', (value) => {
    expect(isPlausibleWhatsappNumber(value)).toBe(false);
  });
});

describe('number formatting', () => {
  it('shows a stored Brazilian mobile number without the country code', () => {
    expect(formatNumberForField('5553999990000')).toBe('53 99999-0000');
  });

  it('shows a stored Brazilian landline number', () => {
    expect(formatNumberForField('555332221111')).toBe('53 3222-1111');
  });

  it('keeps a foreign number as digits', () => {
    expect(formatNumberForField('14155550123')).toBe('14155550123');
    expect(formatNumberForDisplay('14155550123')).toBe('+14155550123');
  });

  it('returns an empty field for no number', () => {
    expect(formatNumberForField(null)).toBe('');
  });

  it('adds the country code for display', () => {
    expect(formatNumberForDisplay('5553999990000')).toBe('+55 53 99999-0000');
  });
});

describe('buildWhatsappUrl', () => {
  it('links to wa.me with digits only and the encoded message', () => {
    expect(buildWhatsappUrl('5553999990000', 'Oi! Vi seu deck Rhinar Rampage no Rathe Arsenal.')).toBe(
      'https://wa.me/5553999990000?text=Oi!%20Vi%20seu%20deck%20Rhinar%20Rampage%20no%20Rathe%20Arsenal.',
    );
  });

  it('encodes characters that would break the query', () => {
    expect(buildWhatsappUrl('+55 (53) 99999-0000', 'a&b=c#d')).toBe(
      'https://wa.me/5553999990000?text=a%26b%3Dc%23d',
    );
  });
});
