import { describe, it, expect } from 'vitest';
import { resolveMedallionBand } from '../resolveMedallionBand';

describe('resolveMedallionBand', () => {
  it.each([
    [0, 'building'],
    [84, 'building'],
    [84.99, 'building'],
    [85, 'accent'],
    [99, 'accent'],
    [99.99, 'accent'],
    [100, 'ready'],
  ])('pct %s resolves to %s', (pct, band) => {
    expect(resolveMedallionBand(pct)).toBe(band);
  });
});
