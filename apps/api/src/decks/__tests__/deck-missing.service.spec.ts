import { ConfigService } from '@nestjs/config';
import { createMock } from '@golevelup/ts-jest';
import { buildProtectedKey, catalog, scoreCandidate, TIER_1_CONFIG } from '@rathe-arsenal/engine';
import { Repository } from 'typeorm';
import { CollectionReadService } from '../../collection/collection-read.service';
import { CardReplacementEntity } from '../../database/entities/card-replacement.entity';
import { DeckCardEntity } from '../../database/entities/deck-card.entity';
import { ReplacementsQueryService } from '../../replacements/replacements-query.service';
import { StoreAnswersService } from '../../stores/store-answers.service';
import { IStoreOffer } from '../../stores/store-offer';
import { TStoreState } from '../../stores/store-state';
import { DeckMissingService, IDeckMissingResponse } from '../deck-missing.service';

const CARD_A = 'emissary-of-tides-red';
const CARD_B = 'flex-red';
const CARD_C = 'adrenaline-rush-red';
const CARD_COAX = 'coax-a-commotion-red';

function offerOf(quantity: number, priceCents = 100): IStoreOffer {
  return { productUrl: 'https://store.test/item', versions: [{ priceCents, quantity, edition: 'ROS', foil: false }] };
}

function standInFor(original: string): string {
  const card = catalog.getCard(original);
  const found = catalog.cards.find((candidate) => {
    if (candidate.cardIdentifier === original || [CARD_A, CARD_B, CARD_C].includes(candidate.cardIdentifier)) return false;
    const score = scoreCandidate(card, candidate, TIER_1_CONFIG);
    return score !== null && score >= TIER_1_CONFIG.floorScore;
  });
  if (!found) throw new Error(`no tier 1 stand-in for ${original}`);
  return found.cardIdentifier;
}

interface IScenarioInput {
  readonly rows: ReadonlyArray<{ cardIdentifier: string; quantity: number; inventoryQuantity?: number; slot?: string }>;
  readonly owned?: Record<string, number>;
  readonly states?: Record<string, TStoreState>;
  readonly offers?: Record<string, IStoreOffer>;
  readonly active?: readonly Partial<CardReplacementEntity>[];
}

async function run(input: IScenarioInput): Promise<IDeckMissingResponse> {
  const deckCardRepo = createMock<Repository<DeckCardEntity>>();
  deckCardRepo.find.mockResolvedValue(
    input.rows.map((row, id) => ({ id, trackedDeckId: 1, slot: 'mainboard', inventoryQuantity: 0, ...row })) as DeckCardEntity[],
  );
  deckCardRepo.query.mockResolvedValue([]);
  const collectionRead = createMock<CollectionReadService>();
  collectionRead.loadOwned.mockResolvedValue(new Map(Object.entries(input.owned ?? {})));
  const stateOf = (cards: readonly string[]) => new Map(cards.map((card) => [card, input.states?.[card] ?? 'priced'] as const));
  const storeAnswers = createMock<StoreAnswersService>();
  storeAnswers.openForOwner.mockImplementation(async (cards) => stateOf(cards));
  storeAnswers.read.mockImplementation(async (cards) => stateOf(cards));
  storeAnswers.readOffers.mockResolvedValue({
    baseUrl: 'https://store.test',
    lastAvailabilityPassAt: new Date('2026-10-19T12:00:00Z'),
    offers: new Map(Object.entries(input.offers ?? {})),
  });
  const active = (input.active ?? []).map((replacement) => ({ id: 'r1', slot: 'mainboard', status: 'active', ...replacement })) as CardReplacementEntity[];
  const replacements = createMock<ReplacementsQueryService>();
  replacements.loadActive.mockResolvedValue(active);
  replacements.loadProtectedCopies.mockResolvedValue(
    new Map(active.map((replacement) => [buildProtectedKey(replacement.replacementCardIdentifier, replacement.slot), replacement.quantity])),
  );
  const config = createMock<ConfigService>();
  config.get.mockReturnValue(undefined);
  return new DeckMissingService(deckCardRepo, collectionRead, storeAnswers, replacements, config).missingFor('user', 1);
}

describe('DeckMissingService', () => {
  it("the copy counts add up to the deck's total copies", async () => {
    const standIn = standInFor(CARD_COAX);
    const cases: ReadonlyArray<[string, IScenarioInput]> = [
      ['all priced', { rows: [{ cardIdentifier: CARD_A, quantity: 3 }], offers: { [CARD_A]: offerOf(5) } }],
      ['all owned', { rows: [{ cardIdentifier: CARD_A, quantity: 3 }], owned: { [CARD_A]: 3 } }],
      ['one shortfall', { rows: [{ cardIdentifier: CARD_A, quantity: 3 }], offers: { [CARD_A]: offerOf(2) } }],
      [
        'one stand-in',
        {
          rows: [{ cardIdentifier: CARD_COAX, quantity: 1 }, { cardIdentifier: standIn, quantity: 2 }],
          owned: { [standIn]: 2 },
          offers: { [CARD_COAX]: offerOf(5) },
          active: [{ originalCardIdentifier: CARD_COAX, replacementCardIdentifier: standIn, quantity: 2 }],
        },
      ],
      ['one looking_up', { rows: [{ cardIdentifier: CARD_A, quantity: 2 }, { cardIdentifier: CARD_B, quantity: 1 }], states: { [CARD_A]: 'looking_up' }, offers: { [CARD_B]: offerOf(5) } }],
      ['one no_price', { rows: [{ cardIdentifier: CARD_A, quantity: 2 }, { cardIdentifier: CARD_B, quantity: 1 }], states: { [CARD_A]: 'no_price' }, offers: { [CARD_B]: offerOf(5) } }],
      ['one card in the inventory only', { rows: [{ cardIdentifier: CARD_A, quantity: 0, inventoryQuantity: 2 }], offers: { [CARD_A]: offerOf(5) } }],
    ];

    for (const [label, input] of cases) {
      const { summary, lines } = await run(input);
      const unpriced = lines
        .filter((line) => line.state === 'looking_up' || line.state === 'no_price')
        .reduce((sum, line) => sum + line.deckNeeded + line.inventoryNeeded, 0);
      const counted =
        summary.buyCopies + summary.lacksCopies + summary.notOnSiteCopies + summary.ownedCopies + summary.standInCopies + unpriced;
      expect({ label, counted }).toEqual({ label, counted: summary.totalCopies });
    }

    const shortfall = await run(cases[2]![1]);
    expect(shortfall.summary).toMatchObject({ totalCopies: 3, buyCopies: 2, buyCents: 200, lacksCopies: 1 });
    const stand = await run(cases[3]![1]);
    expect(stand.summary).toMatchObject({ totalCopies: 3, standInCopies: 2, buyCopies: 1 });
    const unknown = await run(cases[4]![1]);
    expect(unknown.summary).toMatchObject({ lookingUp: 1, noPrice: 0, availabilityCheckedAt: '2026-10-19T12:00:00.000Z', priceValidDays: 30 });
    expect((await run(cases[5]![1])).summary).toMatchObject({ lookingUp: 0, noPrice: 1 });
  });

  it('prices the copies not owned and offers the unused stand-in', async () => {
    const standIn = standInFor(CARD_COAX);
    const { lines, summary } = await run({
      rows: [{ cardIdentifier: CARD_COAX, quantity: 3 }],
      owned: { [standIn]: 1 },
      offers: { [CARD_COAX]: offerOf(5, 6999) },
    });

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      cardIdentifier: CARD_COAX,
      deckNeeded: 3,
      state: 'priced',
      unitPriceCents: 6999,
      lineCents: 20997,
      availableCopies: 3,
      standIn: { cardIdentifier: standIn, copies: 1, savingCents: 6999, used: false, replacementId: null },
    });
    expect(summary).toMatchObject({ buyCopies: 3, buyCents: 20997 });
  });

  it('splits what is missing between the deck and the inventory', async () => {
    const { lines, summary } = await run({
      rows: [
        { cardIdentifier: CARD_A, quantity: 4 },
        { cardIdentifier: CARD_B, quantity: 0, inventoryQuantity: 3 },
        { cardIdentifier: CARD_C, quantity: 2, inventoryQuantity: 1 },
      ],
      owned: { [CARD_C]: 2 },
      offers: { [CARD_A]: offerOf(9), [CARD_B]: offerOf(9), [CARD_C]: offerOf(9) },
    });

    const byCard = Object.fromEntries(lines.map((line) => [line.cardIdentifier, [line.deckNeeded, line.inventoryNeeded]]));
    expect(byCard).toEqual({ [CARD_A]: [4, 0], [CARD_B]: [0, 3], [CARD_C]: [0, 1] });
    expect(summary).toMatchObject({ totalCopies: 10, buyCopies: 8, ownedCopies: 2 });
    expect(lines.reduce((sum, line) => sum + line.deckNeeded, 0)).toBe(4);
    expect(lines.reduce((sum, line) => sum + line.inventoryNeeded, 0)).toBe(4);
  });
});
