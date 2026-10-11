import { catalog, findCardLegalityViolation, ICatalogCard, TSupportedFormat } from '@rathe-arsenal/engine';
import { CardReplacementEntity } from '../../database/entities/card-replacement.entity';
import { ISuggestedUsesInput, planSuggestedUses } from '../plan-suggested-uses';

const FORMAT: TSupportedFormat = 'Classic Constructed';
const HERO = catalog.getCard('katsu-the-wanderer');
const EMISSARY = 'emissary-of-tides-red';
const FLEX = 'flex-red';
const COAX = catalog.getCard('coax-a-commotion-red');
const ADRENALINE = catalog.getCard('adrenaline-rush-red');

function illegalForHero(): ICatalogCard {
  const found = catalog.cards.find(
    (card) => card.pitch === 1 && card.cost !== null && findCardLegalityViolation(card, HERO, FORMAT) !== null,
  );
  if (!found) throw new Error('no red card the hero cannot play');
  return found;
}

function suggestion(original: string, substitute: ICatalogCard, copies = 1): ISuggestedUsesInput['substituted'] {
  return Array.from({ length: copies }, () => ({
    original: { cardIdentifier: original, slot: 'mainboard' },
    match: { substitute },
  }));
}

function missing(cardIdentifier: string, quantity: number): ISuggestedUsesInput['notOwned'][number] {
  return { cardIdentifier, slot: 'mainboard', quantity };
}

function input(overrides: Partial<ISuggestedUsesInput>): ISuggestedUsesInput {
  return {
    notOwned: [],
    substituted: [],
    activeReplacements: [],
    deckCards: [],
    owned: new Map(),
    heroCard: HERO,
    format: FORMAT,
    ...overrides,
  };
}

describe('planSuggestedUses', () => {
  it('plans one use per suggestion and skips what cannot take its place', () => {
    const rows: ReadonlyArray<{
      readonly label: string;
      readonly given: ISuggestedUsesInput;
      readonly uses: ReadonlyArray<readonly [string, string, number]>;
      readonly skipped: number;
    }> = [
      {
        label: 'two suggestions, both legal and owned',
        given: input({
          notOwned: [missing(EMISSARY, 2), missing(FLEX, 2)],
          substituted: [...suggestion(EMISSARY, COAX, 2), ...suggestion(FLEX, ADRENALINE, 2)],
          deckCards: [{ cardIdentifier: EMISSARY, quantity: 2 }, { cardIdentifier: FLEX, quantity: 2 }],
          owned: new Map([[COAX.cardIdentifier, 2], [ADRENALINE.cardIdentifier, 2]]),
        }),
        uses: [[EMISSARY, COAX.cardIdentifier, 2], [FLEX, ADRENALINE.cardIdentifier, 2]],
        skipped: 0,
      },
      {
        label: 'past the copy limit: the deck holds 2, the use needs 2, the limit is 3',
        given: input({
          notOwned: [missing(EMISSARY, 2)],
          substituted: suggestion(EMISSARY, COAX, 2),
          deckCards: [{ cardIdentifier: EMISSARY, quantity: 2 }, { cardIdentifier: COAX.cardIdentifier, quantity: 2 }],
          owned: new Map([[COAX.cardIdentifier, 4]]),
        }),
        uses: [],
        skipped: 1,
      },
      {
        label: 'a card the hero cannot play',
        given: input({
          notOwned: [missing(EMISSARY, 1)],
          substituted: suggestion(EMISSARY, illegalForHero()),
          deckCards: [{ cardIdentifier: EMISSARY, quantity: 1 }],
          owned: new Map([[illegalForHero().cardIdentifier, 3]]),
        }),
        uses: [],
        skipped: 1,
      },
      {
        label: 'no free copy left: 2 owned, the earlier use moved 2',
        given: input({
          notOwned: [missing(EMISSARY, 2), missing(FLEX, 1)],
          substituted: [...suggestion(EMISSARY, COAX), ...suggestion(FLEX, COAX)],
          deckCards: [{ cardIdentifier: EMISSARY, quantity: 2 }, { cardIdentifier: FLEX, quantity: 1 }],
          owned: new Map([[COAX.cardIdentifier, 2]]),
        }),
        uses: [[EMISSARY, COAX.cardIdentifier, 2]],
        skipped: 1,
      },
      {
        label: 'two rows suggest the same card and the first use reaches the limit',
        given: input({
          notOwned: [missing(EMISSARY, 3), missing(FLEX, 1)],
          substituted: [...suggestion(EMISSARY, COAX, 3), ...suggestion(FLEX, COAX)],
          deckCards: [{ cardIdentifier: EMISSARY, quantity: 3 }, { cardIdentifier: FLEX, quantity: 1 }],
          owned: new Map([[COAX.cardIdentifier, 5]]),
        }),
        uses: [[EMISSARY, COAX.cardIdentifier, 3]],
        skipped: 1,
      },
      {
        label: 'every missing copy is already held by an active replacement',
        given: input({
          notOwned: [missing(EMISSARY, 2)],
          substituted: suggestion(EMISSARY, COAX, 2),
          activeReplacements: [
            { replacementCardIdentifier: EMISSARY, slot: 'mainboard', quantity: 2 } as CardReplacementEntity,
          ],
          deckCards: [{ cardIdentifier: EMISSARY, quantity: 2 }],
          owned: new Map([[COAX.cardIdentifier, 3]]),
        }),
        uses: [],
        skipped: 0,
      },
    ];

    for (const row of rows) {
      const plan = planSuggestedUses(row.given);

      expect({ label: row.label, plan }).toEqual({
        label: row.label,
        plan: {
          uses: row.uses.map(([original, replacement, quantity]) => ({ slot: 'mainboard', original, replacement, quantity })),
          skipped: row.skipped,
        },
      });
    }
  });
});
