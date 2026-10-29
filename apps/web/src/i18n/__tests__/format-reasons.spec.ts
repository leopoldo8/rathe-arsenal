import { describe, it, expect } from 'vitest';
import i18n from '../index';
import { formatLegalityReason, formatSwapRationale } from '../format-reasons';
import { setTestLocale } from '../../test/i18n-test-utils';

const t = i18n.t.bind(i18n);

describe('formatLegalityReason', () => {
  it('phrases a short mainboard in pt-BR from the params', () => {
    const detail = { code: 'mainboard_too_small', params: { card: null, count: 42, limit: 60, format: 'Classic Constructed' } };
    expect(formatLegalityReason(detail, 'fallback', t)).toBe(
      'O deck tem 42 cartas, e Classic Constructed exige pelo menos 60.',
    );
  });

  it('uses the legendary wording when the copy limit is the Legendary one', async () => {
    await setTestLocale('en-US');
    const detail = {
      code: 'too_many_copies',
      params: { card: 'Amethyst Amulet', count: 2, limit: 1, format: 'Classic Constructed', legendary: true, restricted: false },
    };
    expect(formatLegalityReason(detail, 'fallback', t)).toBe('Amethyst Amulet is Legendary: only 1 copy is allowed.');
  });

  it('uses the restricted wording when the copy limit is the Living Legend restricted one', async () => {
    await setTestLocale('en-US');
    const detail = {
      code: 'too_many_copies',
      params: { card: 'Awakening', count: 2, limit: 1, format: 'Living Legend', legendary: false, restricted: true },
    };
    expect(formatLegalityReason(detail, 'fallback', t)).toBe('Awakening is restricted in Living Legend: only 1 copy is allowed.');
  });

  it('falls back to the server sentence for a code the client does not know', () => {
    expect(formatLegalityReason({ code: 'something_new', params: {} }, 'Server sentence.', t)).toBe('Server sentence.');
  });

  it('falls back to the server sentence when there is no detail', () => {
    expect(formatLegalityReason(undefined, 'Server sentence.', t)).toBe('Server sentence.');
  });
});

describe('formatSwapRationale', () => {
  const detail = {
    tier: 1,
    pitch: 'red',
    pitchRelation: { relation: 'same', pitch: 'red' },
    originalClasses: ['Brute'],
    candidateGeneric: false,
    sharedClasses: ['Brute'],
    powerDelta: 0,
    defenseDelta: -1,
    sharedKeywords: [],
  } as const;

  it('phrases the comparison in pt-BR with game terms kept in English', () => {
    expect(formatSwapRationale(detail, 'fallback', t)).toBe(
      'mesmo pitch (vermelho), mesma classe (Brute), power igual, defense -1, nenhuma keyword em comum.',
    );
  });

  it('phrases the comparison in en-US with shared keywords and a signed power delta', async () => {
    await setTestLocale('en-US');
    const withKeywords = { ...detail, powerDelta: 1, defenseDelta: 0, sharedKeywords: ['Go again'] };
    expect(formatSwapRationale(withKeywords, 'fallback', t)).toBe(
      'Same pitch (red), same class (Brute), power +1, same defense, shared keywords: Go again.',
    );
  });

  it('the reason states the real relation: the same pitch and a shared class', () => {
    const reason = formatSwapRationale(detail, 'fallback', t);

    expect(reason).toContain('mesmo pitch (vermelho)');
    expect(reason).toContain('mesma classe (Brute)');
  });

  it('the reason states the real relation: a blue candidate for a red original', () => {
    const blue = { ...detail, pitchRelation: { relation: 'different', original: 'red', candidate: 'blue' } } as const;

    const reason = formatSwapRationale(blue, 'fallback', t);

    expect(reason).toContain('pitch diferente: azul em vez de vermelho');
    expect(reason).not.toContain('mesmo pitch');
    expect(reason).not.toContain('Mesmo pitch');
  });

  it('the reason states the real relation: a Generic candidate is a generic card, never a class', () => {
    const generic = { ...detail, originalClasses: ['Generic'], sharedClasses: [], candidateGeneric: true } as const;

    const reason = formatSwapRationale(generic, 'fallback', t);

    expect(reason).toContain('carta genérica');
    expect(reason).not.toContain('mesma classe (Generic)');
    expect(reason).not.toContain('nenhuma das duas tem classe');
  });

  it('the reason states the real relation: no class phrase when the cards share none', () => {
    const none = { ...detail, originalClasses: ['Brute'], sharedClasses: [] } as const;

    const reason = formatSwapRationale(none, 'fallback', t);

    expect(reason).not.toContain('classe');
    expect(reason).not.toContain('nenhuma das duas tem classe');
    expect(reason.startsWith('mesmo pitch (vermelho), power igual')).toBe(true);
  });

  it('marks a tier 2 match as a looser one', () => {
    expect(formatSwapRationale({ ...detail, tier: 2 }, 'fallback', t)).toMatch(/^Troca menos próxima\. mesmo pitch/);
  });

  it('falls back to the stored sentence when the detail is missing', () => {
    expect(formatSwapRationale(null, 'Stored sentence.', t)).toBe('Stored sentence.');
  });
});
