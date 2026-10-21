import { describe, expect, it } from 'vitest';
import { versionShareUrl } from '../shareUrlVersion';

describe('versionShareUrl', () => {
  it('keeps the same address for the same content and changes it when the content changes', () => {
    const url = 'https://app.example/l/AbCdEfGhIjKlMnOpQrStUv';

    const first = versionShareUrl(url, '2x Pummel (Vermelho) · R$ 6,00 cada');

    expect(first).toMatch(/^https:\/\/app\.example\/l\/AbCdEfGhIjKlMnOpQrStUv\?v=[0-9a-z]+$/);
    expect(versionShareUrl(url, '2x Pummel (Vermelho) · R$ 6,00 cada')).toBe(first);
    expect(versionShareUrl(url, '2x Pummel (Vermelho) · R$ 7,00 cada')).not.toBe(first);
  });
});
