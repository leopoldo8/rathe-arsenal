import { describe, expect, it } from 'vitest';
import { validateDeckDetailSearch } from '../-deck-detail-search';

describe('validateDeckDetailSearch', () => {
  it('enters edit mode from a typed ?edit=1, which the router parses as a number', () => {
    expect(validateDeckDetailSearch({ edit: 1 })).toEqual({ edit: '1' });
  });

  it('enters edit mode from the string the app itself navigates with', () => {
    expect(validateDeckDetailSearch({ edit: '1' })).toEqual({ edit: '1' });
  });

  it.each([undefined, 0, '0', 'true', true])('stays in view mode for edit=%s', (edit) => {
    expect(validateDeckDetailSearch({ edit })).toEqual({ edit: undefined });
  });
});
