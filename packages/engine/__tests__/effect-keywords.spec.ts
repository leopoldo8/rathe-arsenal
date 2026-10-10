import { catalog } from '../src/catalog/catalog';
import { findAlternatives } from '../src/substitution/alternatives';
import { TIER_1_CONFIG, TIER_2_CONFIG } from '../src/substitution/constants';
import { scoreCandidate } from '../src/substitution/score';

const card = (id: string) => catalog.getCard(id);

describe('stand-ins keep the missing card effect keywords', () => {
  it('a stand-in for Whisper of the Oracle must have Opt: Scout the Periphery no longer passes, Force Sight still does', () => {
    const whisper = card('whisper-of-the-oracle-red');

    for (const config of [TIER_1_CONFIG, TIER_2_CONFIG]) {
      expect(scoreCandidate(whisper, card('scout-the-periphery-red'), config)).toBeNull();
    }
    expect(scoreCandidate(whisper, card('force-sight-red'), TIER_2_CONFIG)).not.toBeNull();
  });

  it('Go again, Legendary and Specialization are not required: they are on most cards or are deck-building rules', () => {
    const lace = card('lace-with-bloodrot-red');
    expect(lace.keywords).toEqual(['Go again']);
    expect(scoreCandidate(lace, card('lace-with-frailty-red'), TIER_1_CONFIG)).not.toBeNull();

    const legendary = { ...card('lace-with-frailty-red'), keywords: [...card('lace-with-frailty-red').keywords, 'Legendary', 'Specialization'] } as never;
    expect(scoreCandidate(legendary, card('lace-with-inertia-red'), TIER_1_CONFIG)).not.toBeNull();
  });

  it('no alternatives group offers Whisper of the Oracle a card without Opt', () => {
    const whisper = card('whisper-of-the-oracle-red');
    const groups = findAlternatives(
      { missing: whisper, needed: 2, heroCard: card('blaze-firemind'), format: 'Classic Constructed', deckCopies: new Map(), owned: new Map() },
      catalog,
    );
    const offered = groups.flatMap((group) => group.cards.map((entry) => entry.card));

    expect(offered.length).toBeGreaterThan(0);
    expect(offered.filter((entry) => !entry.keywords.includes('Opt' as never)).map((entry) => entry.cardIdentifier)).toEqual([]);
  });
});
