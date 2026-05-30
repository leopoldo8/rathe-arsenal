import { describe, it, expect } from 'vitest';
import { isHeroLegalForFormat } from '../hero-legality';
import type { IHeroListItem } from '../../api/catalog';

const adultHero: IHeroListItem = {
  cardIdentifier: 'dorinthea-ironsong-wtr',
  name: 'Dorinthea Ironsong',
  young: false,
  legalFormats: ['Classic Constructed', 'Living Legend'],
  imageUrl: null,
};

const youngHero: IHeroListItem = {
  cardIdentifier: 'dorinthea-wtr',
  name: 'Dorinthea',
  young: true,
  legalFormats: ['Blitz', 'Silver Age'],
  imageUrl: null,
};

describe('isHeroLegalForFormat', () => {
  it('returns true for any hero when format is empty (no constraint yet)', () => {
    expect(isHeroLegalForFormat(adultHero, '')).toBe(true);
    expect(isHeroLegalForFormat(youngHero, '')).toBe(true);
  });

  it('returns true when the format is in the hero legalFormats', () => {
    expect(isHeroLegalForFormat(adultHero, 'Classic Constructed')).toBe(true);
    expect(isHeroLegalForFormat(youngHero, 'Silver Age')).toBe(true);
  });

  it('returns false when the format is not in the hero legalFormats', () => {
    expect(isHeroLegalForFormat(adultHero, 'Silver Age')).toBe(false);
    expect(isHeroLegalForFormat(youngHero, 'Classic Constructed')).toBe(false);
  });

  it('treats an empty legalFormats list as illegal for any concrete format', () => {
    const noFormats: IHeroListItem = { ...adultHero, legalFormats: [] };
    expect(isHeroLegalForFormat(noFormats, 'Classic Constructed')).toBe(false);
  });
});
