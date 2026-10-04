import { composeRationale, describeRationale } from '../src/substitution/rationale';
import { ICatalogCard } from '../src/catalog/types';
import { Class, Format, Keyword, Rarity, Talent, Type } from '@flesh-and-blood/types';

function makeCard(overrides: Partial<ICatalogCard> = {}): ICatalogCard {
  const base: ICatalogCard = {
    cardIdentifier: 'test-card-red',
    name: 'Test Card',
    classes: [Class.Warrior],
    talents: [] as readonly Talent[],
    types: [Type.Action],
    pitch: 1,
    power: 3,
    defense: 3,
    cost: 1,
    keywords: [Keyword.GoAgain],
    subtypes: [],
    legalHeroes: [],
    legalFormats: [Format.ClassicConstructed],
    rarity: Rarity.Common,
    young: false,
    sets: [],
    imageUrl: null,
  };
  return Object.freeze({ ...base, ...overrides });
}

describe('composeRationale', () => {
  it('produces correct string with shared keywords, same power and defense', () => {
    const missing = makeCard({
      cardIdentifier: 'missing-red',
      name: 'Missing Card',
      keywords: [Keyword.GoAgain, Keyword.Dominate] as readonly Keyword[],
      power: 3,
      defense: 3,
    });

    const substitute = makeCard({
      cardIdentifier: 'substitute-red',
      name: 'Substitute Card',
      keywords: [Keyword.GoAgain] as readonly Keyword[],
      power: 3,
      defense: 3,
    });

    const result = composeRationale(missing, substitute);

    expect(result).toContain('Same pitch (red)');
    expect(result).toContain('same Warrior class');
    expect(result).toContain('same power');
    expect(result).toContain('same defense');
    expect(result).toContain('Go again');
  });

  it('shows power delta when substitute has less power', () => {
    const missing = makeCard({ power: 4 });
    const substitute = makeCard({ power: 3 });

    const result = composeRationale(missing, substitute);

    expect(result).toContain('-1 power');
  });

  it('shows power delta when substitute has more power', () => {
    const missing = makeCard({ power: 3 });
    const substitute = makeCard({ power: 4 });

    const result = composeRationale(missing, substitute);

    expect(result).toContain('+1 power');
  });

  it('shows defense delta when substitute has less defense', () => {
    const missing = makeCard({ defense: 4 });
    const substitute = makeCard({ defense: 3 });

    const result = composeRationale(missing, substitute);

    expect(result).toContain('-1 defense');
  });

  it('shows "no" keywords when there are no shared keywords', () => {
    const missing = makeCard({ keywords: [Keyword.Dominate] as readonly Keyword[] });
    const substitute = makeCard({ keywords: [Keyword.GoAgain] as readonly Keyword[] });

    const result = composeRationale(missing, substitute);

    expect(result).toContain('shared no keywords');
  });

  it('handles blue pitch label', () => {
    const missing = makeCard({ pitch: 3 });
    const substitute = makeCard({ pitch: 3 });

    const result = composeRationale(missing, substitute);

    expect(result).toContain('Same pitch (blue)');
  });

  it('handles yellow pitch label', () => {
    const missing = makeCard({ pitch: 2 });
    const substitute = makeCard({ pitch: 2 });

    const result = composeRationale(missing, substitute);

    expect(result).toContain('Same pitch (yellow)');
  });

  it('handles null pitch as colorless', () => {
    const missing = makeCard({ pitch: null });
    const substitute = makeCard({ pitch: null });

    const result = composeRationale(missing, substitute);

    expect(result).toContain('Same pitch (colorless)');
  });
});

describe('describeRationale', () => {
  it('returns the structured facts behind the rationale sentence', () => {
    const missing = makeCard({
      cardIdentifier: 'missing-yellow',
      pitch: 2,
      classes: [Class.Brute, Class.Warrior],
      keywords: [Keyword.GoAgain, Keyword.Dominate] as readonly Keyword[],
      power: 4,
      defense: 3,
    });
    const substitute = makeCard({
      cardIdentifier: 'substitute-yellow',
      pitch: 2,
      classes: [Class.Brute],
      keywords: [Keyword.GoAgain] as readonly Keyword[],
      power: 5,
      defense: 2,
    });

    expect(describeRationale(missing, substitute, 2)).toEqual({
      tier: 2,
      pitch: 'yellow',
      sharedClasses: [Class.Brute],
      powerDelta: 1,
      defenseDelta: -1,
      sharedKeywords: [Keyword.GoAgain],
    });
  });

  it('reports a colorless pitch and empty overlaps when nothing is shared', () => {
    const missing = makeCard({ pitch: null, classes: [Class.Warrior], keywords: [] as readonly Keyword[] });
    const substitute = makeCard({ pitch: null, classes: [Class.Generic], keywords: [] as readonly Keyword[] });

    expect(describeRationale(missing, substitute)).toMatchObject({
      tier: 1,
      pitch: 'colorless',
      sharedClasses: [],
      sharedKeywords: [],
      powerDelta: 0,
      defenseDelta: 0,
    });
  });
});
