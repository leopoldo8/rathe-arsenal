import { buildPrintingKey, buildPrintingLabel, printingsOfCard, toCardPrintings } from '../printing-key';

describe('printing key', () => {
  it('builds a key from collector code, edition and foiling', () => {
    expect(buildPrintingKey({ identifier: 'WTR153' })).toBe('WTR153');
    expect(buildPrintingKey({ identifier: 'WTR153', foiling: 'Rainbow' })).toBe('WTR153.RF');
    expect(buildPrintingKey({ identifier: 'ARC123', edition: 'First', foiling: 'Cold' })).toBe('ARC123.1E.CF');
    expect(buildPrintingKey({ identifier: 'ARC123', edition: 'Unlimited' })).toBe('ARC123.UE');
    expect(buildPrintingKey({ identifier: 'ARC123', edition: 'Alpha', foiling: 'Gold' })).toBe('ARC123.AE.GF');
  });

  it('builds a label with card data terms in English', () => {
    expect(buildPrintingLabel({ identifier: 'WTR153', foiling: 'Rainbow', edition: 'First' })).toBe(
      'WTR153 · Rainbow Foil · 1st',
    );
    expect(buildPrintingLabel({ identifier: 'WTR153' })).toBe('WTR153');
  });

  it('treats raw printings with the same key as one and keeps the first product id', () => {
    const printings = toCardPrintings([
      { identifier: 'UPR042', foiling: 'Cold' },
      { identifier: 'UPR042', foiling: 'Cold', tcgplayer: { productId: '10' } },
      { identifier: 'UPR042', foiling: 'Cold', tcgplayer: { productId: '11' } },
      { identifier: 'UPR042', tcgplayer: { productId: '12' } },
    ]);
    expect(printings.map((p) => [p.key, p.productId])).toEqual([
      ['UPR042.CF', '10'],
      ['UPR042', '12'],
    ]);
  });

  it('lists catalog printings with unique keys and returns null for an unknown card', () => {
    expect(printingsOfCard('no-such-card')).toBeNull();
    const printings = printingsOfCard('fallen-herald-yellow') ?? [];
    expect(printings.length).toBeGreaterThan(0);
    expect(new Set(printings.map((p) => p.key)).size).toBe(printings.length);
  });
});
