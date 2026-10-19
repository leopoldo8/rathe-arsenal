import { deckProfile } from '../deck-profile';

const AZALEA_MAINBOARD = [
  'boltn-shot-red',
  'call-in-the-big-guns-red',
  'drill-shot-red',
  'dry-powder-shot-red',
  'infecting-shot-blue',
  'infecting-shot-red',
  'infecting-shot-yellow',
  'lace-with-bloodrot-red',
  'lace-with-frailty-red',
  'lace-with-inertia-red',
  'murkmire-grapnel-red',
  'ravenous-rabble-red',
  'read-the-glide-path-red',
  'release-the-tension-red',
  'ridge-rider-shot-red',
  'scout-the-periphery-red',
  'searing-shot-red',
  'spire-sniping-yellow',
  'swift-shot-red',
  'take-aim-red',
];

const AZALEA = [
  { cardIdentifier: 'azalea', quantity: 1, slot: 'hero' },
  { cardIdentifier: 'death-dealer', quantity: 1, slot: 'weapon' },
  ...['blade-beckoner-plating', 'boltn-boots', 'bulls-eye-bracers', 'crows-nest', 'talismanic-lens'].map((cardIdentifier) => ({
    cardIdentifier,
    quantity: 1,
    slot: 'equipment',
  })),
  ...AZALEA_MAINBOARD.map((cardIdentifier) => ({ cardIdentifier, quantity: 2, slot: 'mainboard' })),
];

const KATSU = [
  { cardIdentifier: 'katsu-the-wanderer', quantity: 1, slot: 'hero' },
  { cardIdentifier: 'talishar-the-lost-prince', quantity: 1, slot: 'weapon' },
  { cardIdentifier: 'flex-red', quantity: 3, slot: 'mainboard' },
  { cardIdentifier: 'whelming-gustwave-yellow', quantity: 2, slot: 'mainboard' },
  { cardIdentifier: 'nimblism-blue', quantity: 3, slot: 'mainboard' },
  { cardIdentifier: 'consuming-volition-red', quantity: 1, slot: 'mainboard' },
];

describe('deck profile', () => {
  it('counts the mainboard by defense, the defense reactions, and the attacks with go again and their average power', () => {
    const profile = deckProfile(AZALEA);

    expect(profile.mainboardByDefense).toEqual({ '2': 18, '3': 22 });
    expect(profile.defenseReactions).toBe(0);
    expect(profile.attacks).toEqual({ cards: 24, withGoAgain: 6, averagePower: 4 });
  });

  it('names the equipment slots filled and missing, and sums the equipment defense', () => {
    expect(deckProfile(AZALEA).equipment).toEqual({ slots: ['Head', 'Chest', 'Arms', 'Legs'], missingSlots: [], defense: 2 });
    expect(deckProfile(KATSU).equipment).toEqual({ slots: [], missingSlots: ['Head', 'Chest', 'Arms', 'Legs'], defense: 0 });
  });

  it('balances resources: the average pitch and cost of the mainboard, and what the hero, weapons and equipment spend', () => {
    expect(deckProfile(AZALEA).resources).toEqual({
      averagePitch: 1.2,
      averageCost: 0.2,
      abilityCosts: [
        { cardIdentifier: 'death-dealer', name: 'Death Dealer', kind: 'activation', resources: 1 },
        { cardIdentifier: 'boltn-boots', name: "Bolt'n Boots", kind: 'activation', resources: 1 },
        { cardIdentifier: 'crows-nest', name: "Crow's Nest", kind: 'payment', resources: 1 },
      ],
    });
    expect(deckProfile(KATSU).resources).toEqual({
      averagePitch: 1.9,
      averageCost: 0.1,
      abilityCosts: [{ cardIdentifier: 'talishar-the-lost-prince', name: 'Talishar, the Lost Prince', kind: 'activation', resources: 2 }],
    });
  });

  it('counts the attacks and defense reactions of a deck that has them', () => {
    const profile = deckProfile([...KATSU, { cardIdentifier: 'sink-below-red', quantity: 2, slot: 'mainboard' }]);

    expect(profile.defenseReactions).toBe(2);
    expect(profile.attacks).toEqual({ cards: 6, withGoAgain: 2, averagePower: 3.3 });
    expect(profile.mainboardByDefense).toEqual({ '2': 6, '3': 3, '4': 2 });
  });
});
