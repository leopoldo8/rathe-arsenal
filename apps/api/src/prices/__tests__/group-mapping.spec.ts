import { mapSetToGroup } from '../group-mapping';

const GROUPS = [
  { groupId: 1, name: 'Welcome to Rathe', abbreviation: 'WTR' },
  { groupId: 2, name: 'Armory Deck: Kayo', abbreviation: null },
  { groupId: 3, name: 'Blitz Deck: Heavy Hitters - Kayo', abbreviation: 'KYO' },
];

describe('mapSetToGroup', () => {
  it('matches the set name ignoring case and punctuation', () => {
    expect(mapSetToGroup({ name: 'welcome to rathe', code: 'XXX' }, GROUPS)).toBe(1);
    expect(mapSetToGroup({ name: 'Armory Deck Kayo', code: 'AKO' }, GROUPS)).toBe(2);
  });

  it('falls back to the set code against the group abbreviation', () => {
    expect(mapSetToGroup({ name: 'Kayo Blitz Deck', code: 'kyo' }, GROUPS)).toBe(3);
  });

  it('returns null for a set that does not map', () => {
    expect(mapSetToGroup({ name: 'Nowhere', code: 'ZZZ' }, GROUPS)).toBeNull();
  });
});
