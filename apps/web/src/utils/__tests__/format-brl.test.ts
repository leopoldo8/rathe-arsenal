import { describe, it, expect } from 'vitest';
import { formatBrl } from '../format-brl';

/**
 * Tests for the BRL currency formatter used by the shopping line headline.
 */
describe('formatBrl', () => {
  it('formats 1234 cents as R$ 12,34', () => {
    expect(formatBrl(1234)).toBe('R$ 12,34');
  });

  it('formats 5000 cents as R$ 50,00', () => {
    expect(formatBrl(5000)).toBe('R$ 50,00');
  });

  it('formats 123450 cents as R$ 1.234,50', () => {
    expect(formatBrl(123450)).toBe('R$ 1.234,50');
  });

  it('formats 0 cents as R$ 0,00', () => {
    expect(formatBrl(0)).toBe('R$ 0,00');
  });

  it('formats 100 cents as R$ 1,00', () => {
    expect(formatBrl(100)).toBe('R$ 1,00');
  });

  it('formats 4990 cents as R$ 49,90', () => {
    expect(formatBrl(4990)).toBe('R$ 49,90');
  });

  it('formats 100000 cents as R$ 1.000,00', () => {
    expect(formatBrl(100000)).toBe('R$ 1.000,00');
  });

  it('formats 10000000 cents as R$ 100.000,00', () => {
    expect(formatBrl(10000000)).toBe('R$ 100.000,00');
  });

  it('formats single-digit cents correctly with zero padding', () => {
    expect(formatBrl(101)).toBe('R$ 1,01');
  });
});
