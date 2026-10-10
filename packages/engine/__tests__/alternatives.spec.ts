import { catalog as realCatalog } from '../src/catalog/catalog';
import { buildIndices } from '../src/catalog/indices';
import { Class, Format, ICatalog, ICatalogCard, Keyword, Rarity, Talent, Type } from '../src/catalog/types';
import type { TSupportedFormat } from '../src/legality/types';
import {
  ALTERNATIVES_PER_GROUP,
  compareAlternatives,
  findAlternatives,
  IAlternativeGroup,
  IAlternativesInput,
  TAlternativeGroup,
} from '../src/substitution/alternatives';
import { describeRationale } from '../src/substitution/rationale';

function makeCard(overrides: Partial<ICatalogCard> & { cardIdentifier: string }): ICatalogCard {
  const base: ICatalogCard = {
    cardIdentifier: overrides.cardIdentifier,
    name: overrides.cardIdentifier,
    classes: [Class.Warrior],
    talents: [] as readonly Talent[],
    types: [Type.Action],
    pitch: 1,
    power: 3,
    defense: 3,
    cost: 1,
    keywords: [],
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

function makeCatalog(cards: ICatalogCard[]): ICatalog {
  const frozen = Object.freeze(cards);
  const indices = buildIndices(frozen);
  return Object.freeze({
    cards: frozen,
    indices,
    getCard(identifier: string): ICatalogCard {
      const card = indices.byIdentifier.get(identifier);
      if (!card) throw new Error(`Card not found: ${identifier}`);
      return card;
    },
    getRawCard(identifier: string): unknown {
      return indices.byIdentifier.get(identifier);
    },
  });
}

const KATSU_ADULT = realCatalog.getCard('katsu-the-wanderer');
const KATSU_YOUNG = realCatalog.getCard('katsu');

function input(missing: ICatalogCard, overrides: Partial<IAlternativesInput> = {}): IAlternativesInput {
  return {
    missing,
    needed: 1,
    heroCard: KATSU_ADULT,
    format: 'Classic Constructed',
    deckCopies: new Map(),
    owned: new Map(),
    ...overrides,
  };
}

/** Group name each listed card landed in, by identifier. */
function placements(groups: readonly IAlternativeGroup[]): Map<string, TAlternativeGroup> {
  const result = new Map<string, TAlternativeGroup>();
  for (const group of groups) {
    for (const entry of group.cards) result.set(entry.card.cardIdentifier, group.group);
  }
  return result;
}

function run(
  missing: ICatalogCard,
  candidates: ICatalogCard[],
  overrides: Partial<IAlternativesInput> = {},
): Map<string, TAlternativeGroup> {
  return placements(findAlternatives(input(missing, overrides), makeCatalog([missing, ...candidates])));
}

const DEEP_MISSING = makeCard({
  cardIdentifier: 'missing',
  talents: [Talent.Light],
  keywords: [Keyword.GoAgain],
});
const DEEP_BASELINE = makeCard({
  cardIdentifier: 'candidate',
  talents: [Talent.Light],
  keywords: [Keyword.GoAgain],
});
const ARMS_MISSING = makeCard({
  cardIdentifier: 'missing-arms',
  types: [Type.Equipment],
  subtypes: ['Arms'],
  pitch: null,
  power: null,
  defense: null,
});
const PLAIN_MISSING = makeCard({ cardIdentifier: 'missing-plain' });

describe('findAlternatives groups', () => {
  describe('very_close', () => {
    it('accepts the baseline candidate', () => {
      expect(run(DEEP_MISSING, [DEEP_BASELINE]).get('candidate')).toBe('very_close');
    });

    it.each([
      ['other pitch', DEEP_MISSING, { pitch: 2 }],
      ['no shared class', DEEP_MISSING, { classes: [Class.Ninja] }],
      ['no shared type', DEEP_MISSING, { types: [Type.Instant] }],
      ['no shared talent when the missing card has one', DEEP_MISSING, { talents: [] }],
      ['no shared keyword when the missing card has one', DEEP_MISSING, { keywords: [Keyword.Dominate] }],
      ['other equipment body slot', ARMS_MISSING, { subtypes: ['Legs'] }],
      ['power delta 2', DEEP_MISSING, { power: 5 }],
      ['defense delta 2', DEEP_MISSING, { defense: 1 }],
      ['score below 0.90', DEEP_MISSING, { power: 4, defense: 4 }],
    ] as const)('very_close applies every tier 1 gate: %s', (_gate, missing, overrides) => {
      // The control copies the missing card exactly, so it proves the case rejects on its gate alone.
      const control = makeCard({ ...missing, cardIdentifier: 'control' });
      const candidate = makeCard({ ...missing, cardIdentifier: 'candidate', ...overrides });

      const placed = run(missing, [control, candidate]);

      expect(placed.get('control')).toBe('very_close');
      expect(placed.get('candidate')).not.toBe('very_close');
    });
  });

  describe('close', () => {
    const noKeywords = makeCard({ cardIdentifier: 'missing-bare' });

    it('close applies the tier 2 gates and floor: zero keyword overlap with power delta 2 is accepted', () => {
      const candidate = makeCard({ cardIdentifier: 'candidate', keywords: [Keyword.Dominate], power: 5 });

      expect(run(noKeywords, [candidate]).get('candidate')).toBe('close');
    });

    it('close applies the tier 2 gates and floor: zero keyword overlap on a card with keywords costs 0.15', () => {
      const keyworded = makeCard({ cardIdentifier: 'missing-keyworded', keywords: [Keyword.GoAgain] });
      const candidate = makeCard({ cardIdentifier: 'candidate', keywords: [Keyword.Dominate] });

      const groups = findAlternatives(input(keyworded), makeCatalog([keyworded, candidate]));

      expect(placements(groups).get('candidate')).toBe('close');
      expect(groups[0]?.cards[0]?.score).toBeCloseTo(0.85, 10);
    });

    it('close applies the tier 2 gates and floor: power delta 3 is rejected', () => {
      const candidate = makeCard({ cardIdentifier: 'candidate', power: 6 });

      expect(run(noKeywords, [candidate]).has('candidate')).toBe(false);
    });

    it('close applies the tier 2 gates and floor: a score below 0.70 is rejected', () => {
      // power delta 1 plus defense delta 2 scores 0.55
      const candidate = makeCard({ cardIdentifier: 'candidate', power: 4, defense: 5 });

      expect(run(noKeywords, [candidate]).has('candidate')).toBe(false);
    });
  });

  describe('other_pitch', () => {
    it('other_pitch relaxes only the pitch: a close match at another pitch is accepted', () => {
      const candidate = makeCard({ cardIdentifier: 'candidate', pitch: 2 });

      expect(run(PLAIN_MISSING, [candidate]).get('candidate')).toBe('other_pitch');
    });

    it('other_pitch relaxes only the pitch: another pitch without a shared class is rejected', () => {
      const candidate = makeCard({ cardIdentifier: 'candidate', pitch: 2, classes: [Class.Ninja] });

      expect(run(PLAIN_MISSING, [candidate]).has('candidate')).toBe(false);
    });

    it('other_pitch relaxes only the pitch: another pitch that close would reject at that pitch is rejected', () => {
      const candidate = makeCard({ cardIdentifier: 'candidate', pitch: 3, power: 6 });

      expect(run(PLAIN_MISSING, [candidate]).has('candidate')).toBe(false);
    });
  });

  describe('generic', () => {
    const generic = { classes: [Class.Generic] };
    const armsGeneric = { ...generic, types: [Type.Equipment], subtypes: ['Arms'], pitch: null, power: null, defense: null };

    it('generic applies its six gates: accepts a Generic card with the same pitch, type and stats within 2', () => {
      const candidate = makeCard({ cardIdentifier: 'candidate', ...generic, power: 5, defense: 1 });

      expect(run(PLAIN_MISSING, [candidate]).get('candidate')).toBe('generic');
    });

    it('generic applies its six gates: accepts a Generic equipment piece for the same body slot', () => {
      const candidate = makeCard({ cardIdentifier: 'candidate', ...armsGeneric });

      expect(run(ARMS_MISSING, [candidate]).get('candidate')).toBe('generic');
    });

    it.each([
      ['non-Generic class', PLAIN_MISSING, { classes: [Class.Ninja] }],
      ['other pitch', PLAIN_MISSING, { ...generic, pitch: 2 }],
      ['no shared type', PLAIN_MISSING, { ...generic, types: [Type.Instant] }],
      ['other body slot', ARMS_MISSING, { ...armsGeneric, subtypes: ['Legs'] }],
      ['power delta 3', PLAIN_MISSING, { ...generic, power: 6 }],
      ['defense delta 3', PLAIN_MISSING, { ...generic, defense: 0 }],
    ] as const)('generic applies its six gates: rejects %s', (_gate, missing, overrides) => {
      const candidate = makeCard({ cardIdentifier: 'candidate', ...overrides });

      expect(run(missing, [candidate]).has('candidate')).toBe(false);
    });
  });

  it('lists a card once, in the strictest group', () => {
    const genericMissing = makeCard({ cardIdentifier: 'missing-generic', classes: [Class.Generic] });
    const candidate = makeCard({ cardIdentifier: 'candidate', classes: [Class.Generic] });
    const groups = findAlternatives(input(genericMissing), makeCatalog([genericMissing, candidate]));

    expect(groups.map((g) => g.group)).toEqual(['very_close']);

    const emissary = realCatalog.getCard('emissary-of-tides-red');
    const real = findAlternatives(input(emissary, { needed: 2 }), realCatalog);
    const identifiers = real.flatMap((g) => g.cards.map((c) => c.card.cardIdentifier));

    expect(new Set(identifiers).size).toBe(identifiers.length);
  });

  it('does not offer a card cut by the cap to a looser group', () => {
    const cards = Array.from({ length: ALTERNATIVES_PER_GROUP + 2 }, (_, index) =>
      makeCard({ cardIdentifier: `tier1-${String(index).padStart(2, '0')}` }),
    );

    const placed = run(PLAIN_MISSING, cards);

    expect(placed.size).toBe(ALTERNATIVES_PER_GROUP);
    expect([...placed.values()].every((group) => group === 'very_close')).toBe(true);
  });

  it('never lists itself, a hero or a token', () => {
    const hero = makeCard({ cardIdentifier: 'hero-twin', types: [Type.Hero, Type.Action] });
    const token = makeCard({ cardIdentifier: 'token-twin', types: [Type.Token, Type.Action] });
    const normal = makeCard({ cardIdentifier: 'normal' });

    const placed = run(PLAIN_MISSING, [hero, token, normal]);

    expect([...placed.keys()]).toEqual(['normal']);

    const emissary = realCatalog.getCard('emissary-of-tides-red');
    const search = findAlternatives(input(emissary, { query: 'Katsu' }), realCatalog);
    const real = findAlternatives(input(emissary), realCatalog);
    const everything = [...search, ...real].flatMap((g) => g.cards.map((c) => c.card));

    expect(everything.some((card) => card.types.includes(Type.Hero) || card.types.includes(Type.Token))).toBe(false);
    expect(everything.some((card) => card.cardIdentifier === emissary.cardIdentifier)).toBe(false);
  });
});

describe('findAlternatives order and cap', () => {
  it('orders the four groups, drops empty ones and caps each at 10', () => {
    const emissary = realCatalog.getCard('emissary-of-tides-red');

    const groups = findAlternatives(input(emissary, { needed: 2 }), realCatalog);

    expect(groups.map((g) => g.group)).toEqual(['very_close', 'close', 'other_pitch', 'generic']);
    expect(groups.find((g) => g.group === 'very_close')?.cards).toHaveLength(10);
    expect(groups.every((g) => g.cards.length > 0 && g.cards.length <= ALTERNATIVES_PER_GROUP)).toBe(true);

    const onlyGeneric = makeCard({ cardIdentifier: 'only-generic', classes: [Class.Generic] });
    const sparse = findAlternatives(input(PLAIN_MISSING), makeCatalog([PLAIN_MISSING, onlyGeneric]));

    expect(sparse.map((g) => g.group)).toEqual(['generic']);
  });
});

describe('findAlternatives legality', () => {
  const SILVER_AGE_CASES: ReadonlyArray<{ readonly rule: string; readonly overrides: Partial<ICatalogCard>; readonly format: TSupportedFormat; readonly hero: ICatalogCard }> = [
    { rule: 'banned in the format', overrides: { bannedFormats: [Format.ClassicConstructed] }, format: 'Classic Constructed', hero: KATSU_ADULT },
    { rule: 'not legal in the format', overrides: { legalFormats: [Format.Blitz] }, format: 'Classic Constructed', hero: KATSU_ADULT },
    { rule: 'not legal for the hero', overrides: { legalHeroes: ['Dorinthea'] }, format: 'Classic Constructed', hero: KATSU_ADULT },
    { rule: 'outside the Silver Age rarities', overrides: { legalFormats: [Format.SilverAge], rarity: Rarity.Majestic }, format: 'Silver Age', hero: KATSU_YOUNG },
  ];

  const MISSING_CARDS = [
    ['mainboard', PLAIN_MISSING, { }],
    ['equipment', ARMS_MISSING, { types: [Type.Equipment], subtypes: ['Arms'], pitch: null, power: null, defense: null }],
  ] as const;

  describe.each(MISSING_CARDS)('with the missing card in %s', (_slot, missing, shape) => {
    it.each(SILVER_AGE_CASES)('drops candidates the per-card legality rejects: $rule', ({ overrides, format, hero }) => {
      const formatBase = format === 'Silver Age' ? { legalFormats: [Format.SilverAge] } : {};
      const control = makeCard({ cardIdentifier: 'control', ...shape, ...formatBase });
      const rejected = makeCard({ cardIdentifier: 'rejected', ...shape, ...overrides });
      const missingInFormat = makeCard({ ...missing, ...formatBase });

      const placed = run(missingInFormat, [control, rejected], { format, heroCard: hero });

      expect(placed.has('control')).toBe(true);
      expect(placed.has('rejected')).toBe(false);
    });
  });

  it.each([
    ['Classic Constructed, 1 held + 2 needed', 'Classic Constructed', KATSU_ADULT, 1, 2, [], true],
    ['Classic Constructed, 2 held + 2 needed', 'Classic Constructed', KATSU_ADULT, 2, 2, [], false],
    ['Blitz, 0 held + 2 needed', 'Blitz', KATSU_YOUNG, 0, 2, [], true],
    ['Blitz, 1 held + 2 needed', 'Blitz', KATSU_YOUNG, 1, 2, [], false],
    ['Legendary, 0 held + 1 needed', 'Classic Constructed', KATSU_ADULT, 0, 1, [Keyword.Legendary], true],
    ['Legendary, 1 held + 1 needed', 'Classic Constructed', KATSU_ADULT, 1, 1, [Keyword.Legendary], false],
  ] as const)('enforces the copy limit across slots: %s', (_label, format, hero, held, needed, keywords, listed) => {
    const formats = [Format.ClassicConstructed, Format.Blitz];
    const missing = makeCard({ cardIdentifier: 'missing', legalFormats: formats, keywords });
    const candidate = makeCard({ cardIdentifier: 'candidate', legalFormats: formats, keywords });

    const placed = run(missing, [candidate], {
      format,
      heroCard: hero,
      needed,
      deckCopies: new Map([['candidate', held]]),
    });

    expect(placed.has('candidate')).toBe(listed);
  });
});

describe('findAlternatives ordering', () => {
  const MISSING_TEXT = 'Your next arrow attack this turn gets +3{p} and "When this hits a hero, create a Frailty token."';
  const MISSING_BUFF = makeCard({ cardIdentifier: 'missing-buff', subtypes: ['Non-Attack'], cost: 0, functionalText: MISSING_TEXT });
  const entry = (
    name: string,
    score: number,
    freeCopies: number,
    overrides: Partial<ICatalogCard> = {},
  ) => ({
    card: makeCard({ cardIdentifier: name, subtypes: ['Non-Attack'], cost: 0, functionalText: '', ...overrides }),
    score,
    freeCopies,
  });
  const order = (entries: ReturnType<typeof entry>[], needed = 2): string[] =>
    [...entries].sort((a, b) => compareAlternatives(a, b, needed, MISSING_BUFF)).map((e) => e.card.cardIdentifier);

  it('orders by fit: a higher score comes first whatever the other keys say', () => {
    expect(order([entry('same-everything', 0.85, 3, { functionalText: MISSING_TEXT }), entry('higher-score', 0.9, 0, { cost: 3 })])).toEqual([
      'higher-score',
      'same-everything',
    ]);
  });

  it('orders by fit: at equal score, a card with the same subtypes as the missing card comes first', () => {
    expect(
      order([
        entry('attack', 1, 3, { subtypes: ['Attack'] }),
        entry('arrow', 1, 3, { subtypes: ['Arrow', 'Attack'] }),
        entry('trap', 1, 3, { subtypes: ['Non-Attack', 'Trap'] }),
        entry('buff', 1, 0, { cost: 2 }),
      ]),
    ).toEqual(['buff', 'arrow', 'attack', 'trap']);
  });

  it('orders by fit: at equal score and role, the closer cost comes first', () => {
    expect(order([entry('cost-2', 1, 3, { cost: 2 }), entry('cost-1', 1, 3, { cost: 1 }), entry('cost-0', 1, 0, { cost: 0 })])).toEqual([
      'cost-0',
      'cost-1',
      'cost-2',
    ]);
  });

  it('orders by fit: at equal score, role and cost, the more similar rules text comes first', () => {
    expect(
      order([
        entry('unrelated', 1, 3, { functionalText: 'Draw a card.' }),
        entry('extra-clause', 1, 3, { functionalText: 'Your next arrow attack this turn gets +3{p}. You may untap a bow you control.' }),
        entry('sibling', 1, 0, { functionalText: 'Your next arrow attack this turn gets +3{p} and "When this hits a hero, create an Inertia token."' }),
      ]),
    ).toEqual(['sibling', 'extra-clause', 'unrelated']);
  });

  it('orders by fit: ownership only breaks a tie the fit keys leave, then the name does', () => {
    expect(order([entry('b-unowned', 1, 0), entry('c-owned', 1, 2), entry('a-unowned', 1, 0), entry('d-some', 1, 1)])).toEqual([
      'c-owned',
      'a-unowned',
      'b-unowned',
      'd-some',
    ]);
    expect(order([entry('owned-cost-1', 1, 2, { cost: 1 }), entry('unowned-cost-0', 1, 0)])).toEqual(['unowned-cost-0', 'owned-cost-1']);
  });

  it('orders Lace with Bloodrot alternatives for Azalea by role, cost, then rules text, and keeps the 10 best', () => {
    const lace = realCatalog.getCard('lace-with-bloodrot-red');
    const groups = findAlternatives(
      input(lace, { heroCard: realCatalog.getCard('azalea-ace-in-the-hole'), needed: 3 }),
      realCatalog,
    );

    expect(groups[0]!.group).toBe('very_close');
    expect(groups[0]!.cards.map((c) => c.card.cardIdentifier)).toEqual([
      'lace-with-frailty-red',
      'lace-with-inertia-red',
      'drop-the-anchor-red',
      'fire-in-the-hole-red',
      'seek-and-destroy-red',
      'read-the-glide-path-red',
      'release-the-tension-red',
      'toxicity-red',
      'call-in-the-big-guns-red',
      'take-aim-red',
    ]);
    expect(groups[0]!.cards.every((c) => c.card.cost === 0 && c.card.subtypes.join() === 'Non-Attack')).toBe(true);
  });

  it('an owned card never moves into a stricter group', () => {
    const strict = makeCard({ cardIdentifier: 'strict' });
    const looser = makeCard({ cardIdentifier: 'looser', pitch: 2 });

    const groups = findAlternatives(
      input(PLAIN_MISSING, { owned: new Map([['looser', 5]]) }),
      makeCatalog([PLAIN_MISSING, strict, looser]),
    );

    expect(groups.map((g) => [g.group, g.cards.map((c) => c.card.cardIdentifier)])).toEqual([
      ['very_close', ['strict']],
      ['other_pitch', ['looser']],
    ]);
  });

  it('reports free copies as owned minus the copies already in the deck, never below 0', () => {
    const candidate = makeCard({ cardIdentifier: 'candidate' });
    const other = makeCard({ cardIdentifier: 'other' });

    const groups = findAlternatives(
      input(PLAIN_MISSING, {
        owned: new Map([['candidate', 3], ['other', 1]]),
        deckCopies: new Map([['candidate', 1], ['other', 2]]),
      }),
      makeCatalog([PLAIN_MISSING, candidate, other]),
    );
    const free = new Map(groups.flatMap((g) => g.cards.map((c) => [c.card.cardIdentifier, c.freeCopies] as const)));

    expect(free.get('candidate')).toBe(2);
    expect(free.get('other')).toBe(0);
  });
});

describe('findAlternatives rationale', () => {
  it('rationale carries the swap detail and the relaxed rule', () => {
    const emissary = realCatalog.getCard('emissary-of-tides-red');
    const groups = findAlternatives(input(emissary, { needed: 2 }), realCatalog);
    const expected: Record<string, { tier: 1 | 2; relaxed: 'pitch' | 'class' | null }> = {
      very_close: { tier: 1, relaxed: null },
      close: { tier: 2, relaxed: null },
      other_pitch: { tier: 2, relaxed: 'pitch' },
      generic: { tier: 2, relaxed: 'class' },
    };

    expect(groups).toHaveLength(4);
    for (const group of groups) {
      const { tier, relaxed } = expected[group.group]!;
      for (const entry of group.cards) {
        expect(entry.rationale).toEqual({ ...describeRationale(emissary, entry.card, tier), relaxed });
      }
    }
  });
});

describe('findAlternatives search', () => {
  const dash = realCatalog.getCard('dash-io');
  const emissary = realCatalog.getCard('emissary-of-tides-red');

  it('search group matches by name with legality: names starting with the query come first', () => {
    const groups = findAlternatives(input(emissary, { heroCard: dash, query: 'sink' }), realCatalog);

    expect(groups.map((g) => g.group)).toEqual(['search']);
    const ids = groups[0]!.cards.map((c) => c.card.cardIdentifier);
    expect(ids).toContain('sink-below-red');
    expect(ids).toContain('aether-sink-yellow');
    expect(ids.indexOf('sink-below-red')).toBeLessThan(ids.indexOf('aether-sink-yellow'));
    expect(groups[0]!.cards.every((c) => c.card.name.toLowerCase().includes('sink'))).toBe(true);
  });

  it('search group matches by name with legality: ignores case and surrounding spaces', () => {
    const lower = findAlternatives(input(emissary, { heroCard: dash, query: 'sink' }), realCatalog);
    const padded = findAlternatives(input(emissary, { heroCard: dash, query: '  SINK ' }), realCatalog);

    expect(padded).toEqual(lower);
  });

  it('search group matches by name with legality: applies the hero, copy-limit and exclusion rules', () => {
    const forKatsu = findAlternatives(input(emissary, { query: 'sink' }), realCatalog);
    const capped = findAlternatives(
      input(emissary, { heroCard: dash, query: 'sink', deckCopies: new Map([['sink-below-red', 3]]) }),
      realCatalog,
    );

    const katsuIds = forKatsu.flatMap((g) => g.cards.map((c) => c.card.cardIdentifier));
    const cappedIds = capped.flatMap((g) => g.cards.map((c) => c.card.cardIdentifier));
    expect(katsuIds).not.toContain('aether-sink-yellow');
    expect(cappedIds).not.toContain('sink-below-red');
    expect(cappedIds).toContain('sink-below-blue');

    const itself = findAlternatives(input(emissary, { query: 'Emissary of Tides' }), realCatalog);
    expect(itself.flatMap((g) => g.cards.map((c) => c.card.cardIdentifier))).not.toContain('emissary-of-tides-red');
  });

  it('search group matches by name with legality: a query matching more than 10 legal cards returns 10', () => {
    const groups = findAlternatives(input(emissary, { query: 'of ' }), realCatalog);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.cards).toHaveLength(10);
    expect(groups[0]!.cards.every((c) => c.rationale.relaxed === null)).toBe(true);
  });

  it('search group matches by name with legality: no match gives no group', () => {
    expect(findAlternatives(input(emissary, { query: 'zzzzzz' }), realCatalog)).toEqual([]);
  });
});
