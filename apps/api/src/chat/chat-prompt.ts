export interface IDeckSummary {
  readonly id: number;
  readonly name: string;
  readonly hero: string | null;
  readonly format: string;
  readonly status: string;
  readonly readinessPercent: number | null;
}

export interface IBoundDeck {
  readonly id: number;
  readonly name: string;
  readonly cards: readonly { readonly cardIdentifier: string; readonly quantity: number; readonly slot: string }[];
}

export interface IPromptInput {
  readonly locale: string;
  readonly decks: readonly IDeckSummary[];
  readonly boundDeck: IBoundDeck | null;
  readonly today: Date;
}

const PRIMER = [
  'You are Tutor, the deck-building assistant of Rathe Arsenal, a site where Flesh and Blood players track their decks, collection and readiness.',
  'Flesh and Blood is a trading card game where two heroes fight; each deck has one hero, weapons, equipment and a card pool, and is built for one format (Classic Constructed, Blitz, Living Legend, Silver Age).',
  'Cards have a pitch value (red 1, yellow 2, blue 3) used to pay costs; most cards may be played at most 3 times in a deck, Legendary cards once.',
  'You read the user\'s data only through the tools: their decks, owned copies, the card catalog with legality, their latest recommendations, tournament decks with placement copied from Fabrary, and the comprehensive rules.',
  'Tournament placement comes from the event name of the deck; treat it as reported, and say so when a deck has no placement.',
].join('\n');

const RULES = [
  'When you state a game rule, look it up with search_rules and cite the rule number, for example "(rule 1.3.2)".',
  'If search_rules finds nothing, answer from your own knowledge and say that you could not confirm the rule in the comprehensive rules.',
  'You never change decks yourself. To suggest a new deck call propose_deck; to suggest replacing a card in one of the user\'s decks call propose_swap. The user decides whether to apply it.',
  'Never claim a deck was changed. If a proposal tool answers ok: false, fix the proposal or explain why it cannot be made.',
  'Use card identifiers exactly as the tools return them.',
].join('\n');

function languageLine(locale: string): string {
  return locale === 'pt-BR'
    ? 'Answer in Brazilian Portuguese; keep card names in English.'
    : 'Answer in English.';
}

function deckLine(deck: IDeckSummary): string {
  const readiness = deck.readinessPercent === null ? 'readiness unknown' : `readiness ${Math.round(deck.readinessPercent)}%`;
  return `- id ${deck.id} | ${deck.name} | hero ${deck.hero ?? 'unknown'} | ${deck.format} | status ${deck.status} | ${readiness}`;
}

export function buildSystemInstruction(input: IPromptInput): string {
  const sections = [
    PRIMER,
    RULES,
    languageLine(input.locale),
    `Today is ${input.today.toISOString().slice(0, 10)}.`,
    input.decks.length === 0 ? 'The user has no decks yet.' : ['The user\'s decks:', ...input.decks.map(deckLine)].join('\n'),
  ];
  if (input.boundDeck) {
    const slots = ['hero', 'weapon', 'equipment', 'mainboard'];
    const lines = slots.flatMap((slot) => {
      const cards = input.boundDeck!.cards.filter((card) => card.slot === slot);
      return cards.length === 0 ? [] : [`${slot}:`, ...cards.map((card) => `  ${card.quantity}x ${card.cardIdentifier}`)];
    });
    sections.push(
      [`This conversation is about deck id ${input.boundDeck.id} (${input.boundDeck.name}). Its cards:`, ...lines].join('\n'),
    );
  }
  return sections.join('\n\n');
}
