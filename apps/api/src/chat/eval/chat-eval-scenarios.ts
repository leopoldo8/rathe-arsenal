export const EVAL_DECKS = [
  { key: 'azalea', url: 'https://fabrary.net/decks/01M2EA2J62QDE6ZZYP0YPXEBG4', hero: 'Azalea' },
  { key: 'katsu', url: 'https://fabrary.net/decks/01KWR11MPS68F4XV6C8BB0GEPV', hero: 'Katsu, the Wanderer' },
  { key: 'kano', url: 'https://fabrary.net/decks/01GJ777JJXN7QT9NXV9EVG7T8Q', hero: 'Kano' },
] as const;

export type TEvalDeckKey = (typeof EVAL_DECKS)[number]['key'];

export interface IEvalScenario {
  readonly id: string;
  readonly deck: TEvalDeckKey | null;
  readonly question: string;
  readonly locale: 'pt-BR' | 'en-US';
}

function tileQuestions(deck: (typeof EVAL_DECKS)[number]): IEvalScenario[] {
  return [
    { id: `tile-tournaments-${deck.key}`, deck: deck.key, question: `Como outros jogam o ${deck.hero} nos torneios?`, locale: 'pt-BR' },
    { id: `tile-swap-${deck.key}`, deck: deck.key, question: 'Que carta deste deck vale trocar?', locale: 'pt-BR' },
    { id: `tile-missing-${deck.key}`, deck: deck.key, question: 'O que mais falta para ficar pronto?', locale: 'pt-BR' },
  ];
}

export const EVAL_SCENARIOS: readonly IEvalScenario[] = [
  ...EVAL_DECKS.flatMap(tileQuestions),
  { id: 'ready-hero', deck: null, question: 'Como outras pessoas montam o Kano nos torneios?', locale: 'pt-BR' },
  { id: 'ready-next-hero', deck: null, question: 'Qual herói devo montar a seguir com as cartas que tenho?', locale: 'pt-BR' },
  { id: 'ready-triggers', deck: null, question: 'Explique a ordem dos gatilhos ao atacar', locale: 'pt-BR' },
  { id: 'no-data-hero', deck: null, question: 'Como os jogadores montam a Viserai, Usurper nos torneios?', locale: 'pt-BR' },
  { id: 'build-deck', deck: null, question: 'Monte um deck de Katsu para Classic Constructed aproveitando as cartas que eu tenho.', locale: 'pt-BR' },
  { id: 'meta-en', deck: null, question: 'Which heroes have the most top 8 finishes in Classic Constructed this year?', locale: 'en-US' },
];
