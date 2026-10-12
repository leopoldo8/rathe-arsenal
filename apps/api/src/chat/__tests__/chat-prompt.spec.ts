import { buildSystemInstruction } from '../chat-prompt';

const DECKS = [
  { id: 7, name: 'Katsu CC', hero: 'Katsu, the Wanderer', format: 'Classic Constructed', status: 'building', readinessPercent: 82.4 },
  { id: 9, name: 'Oscilio Blitz', hero: 'Oscilio', format: 'Blitz', status: 'idea', readinessPercent: null },
];

describe('chat system instruction', () => {
  it('the instruction covers language, citations, proposals and unconfirmed rules', () => {
    const pt = buildSystemInstruction({ locale: 'pt-BR', decks: [], boundDeck: null, today: new Date('2026-10-11T00:00:00Z') });
    const en = buildSystemInstruction({ locale: 'en-US', decks: [], boundDeck: null, today: new Date('2026-10-11T00:00:00Z') });

    expect(pt).toContain('Flesh and Blood is a trading card game');
    expect(pt).toContain('Answer in Brazilian Portuguese');
    expect(en).toContain('Answer in English');
    expect(en).toContain('cite the rule number');
    expect(en).toContain('You never change decks yourself');
    expect(en).toContain('could not confirm the rule');
  });

  it('the instruction names the assistant Tutor in every locale', () => {
    const today = new Date('2026-10-11T00:00:00Z');

    const texts = ['pt-BR', 'en-US'].map((locale) => buildSystemInstruction({ locale, decks: [], boundDeck: null, today }));

    for (const text of texts) expect(text).toContain('You are Tutor, the deck-building assistant of Rathe Arsenal');
  });

  it('the instruction tells the model which Markdown to write', () => {
    const today = new Date('2026-10-11T00:00:00Z');

    const texts = ['pt-BR', 'en-US'].map((locale) => buildSystemInstruction({ locale, decks: [], boundDeck: null, today }));

    for (const text of texts) {
      expect(text).toContain(
        'Format answers in Markdown: short paragraphs, lists, **bold**, inline code, and a table when comparing decks or results. Link only to URLs a tool returned. Do not use images or HTML.',
      );
    }
  });

  it("the summary lists every deck and a bound deck's cards", () => {
    const text = buildSystemInstruction({
      locale: 'en-US',
      decks: DECKS,
      boundDeck: {
        id: 7,
        name: 'Katsu CC',
        cards: [
          { cardIdentifier: 'emissary-of-tides-red', quantity: 2, slot: 'mainboard' },
          { cardIdentifier: 'talishar-the-lost-prince', quantity: 1, slot: 'weapon' },
        ],
      },
      today: new Date('2026-10-11T00:00:00Z'),
    });

    expect(text).toContain('- id 7 | Katsu CC | hero Katsu, the Wanderer | Classic Constructed | status building | readiness 82%');
    expect(text).toContain('- id 9 | Oscilio Blitz | hero Oscilio | Blitz | status idea | readiness unknown');
    expect(text).toMatch(/mainboard:\n {2}2x emissary-of-tides-red/);
    expect(text).toMatch(/weapon:\n {2}1x talishar-the-lost-prince/);
  });
});
