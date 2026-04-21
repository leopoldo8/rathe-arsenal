import { composeRationale } from '../src/substitution/rationale';
import { ICatalogCard } from '../src/catalog/types';
import { Class, Keyword, Talent, Type } from '@flesh-and-blood/types';

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
