import { describe, expect, it } from 'vitest';
import { validateSharedDeckSearch } from '../-shared-deck-search';

describe('validateSharedDeckSearch', () => {
  it('keeps view=missing', () => {
    expect(validateSharedDeckSearch({ view: 'missing' })).toEqual({ view: 'missing' });
  });

  it.each([undefined, 'all', '', 1, null, ['missing']])('drops %s so the full deck shows', (view) => {
    expect(validateSharedDeckSearch({ view })).toEqual({});
  });
});
