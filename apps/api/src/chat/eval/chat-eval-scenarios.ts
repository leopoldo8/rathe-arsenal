import { catalog, ICatalogCard } from '@rathe-arsenal/engine';
import { hasSameRole } from '../swap-analysis';

export const EVAL_DECKS = [
  { key: 'azalea', url: 'https://fabrary.net/decks/01M2EA2J62QDE6ZZYP0YPXEBG4', hero: 'Azalea' },
  { key: 'katsu', url: 'https://fabrary.net/decks/01KWR11MPS68F4XV6C8BB0GEPV', hero: 'Katsu, the Wanderer' },
  { key: 'kano', url: 'https://fabrary.net/decks/01GJ777JJXN7QT9NXV9EVG7T8Q', hero: 'Kano' },
] as const;

export type TEvalDeckKey = (typeof EVAL_DECKS)[number]['key'];

export interface IEvalSwap {
  readonly original: string;
  readonly replacement: string;
}

export interface IEvalOutcome {
  readonly text: string;
  readonly toolCalls: readonly string[];
  readonly swaps: readonly IEvalSwap[];
}

/** The reason the answer fails the scenario, or null when it passes. */
export type TEvalCheck = (outcome: IEvalOutcome) => string | null;

export interface IEvalScenario {
  readonly id: string;
  readonly deck: TEvalDeckKey | null;
  readonly question: string;
  readonly locale: 'pt-BR' | 'en-US';
  readonly check?: TEvalCheck;
}

const card = (cardIdentifier: string): ICatalogCard => catalog.getCard(cardIdentifier);

function keepsRole(original: string): TEvalCheck {
  return ({ swaps }) => {
    const changed = swaps.filter((swap) => swap.original === original && !hasSameRole(card(original), card(swap.replacement)));
    return changed.length === 0 ? null : `role changed: ${changed.map((swap) => `${swap.original} -> ${swap.replacement}`).join(', ')}`;
  };
}

function costSaid(original: string): TEvalCheck {
  return ({ swaps, text }) => {
    const pricier = swaps.filter((swap) => swap.original === original && (card(swap.replacement).cost ?? 0) > (card(original).cost ?? 0));
    if (pricier.length === 0 || /custo|cost/i.test(text)) return null;
    return `costs more and the answer never mentions cost: ${pricier.map((swap) => swap.replacement).join(', ')}`;
  };
}

const arrowsWhenAsked: TEvalCheck = ({ swaps, text }) => {
  if (!/flecha|arrow/i.test(text)) return 'the answer does not talk about arrows';
  const notArrows = swaps.filter((swap) => !card(swap.replacement).subtypes.some((subtype) => String(subtype) === 'Arrow'));
  return notArrows.length === 0 ? null : `not an arrow: ${notArrows.map((swap) => swap.replacement).join(', ')}`;
};

function neverProposes(replacement: string): TEvalCheck {
  return ({ swaps }) => (swaps.some((swap) => swap.replacement === replacement) ? `proposed ${replacement}` : null);
}

const ownershipLookedUp: TEvalCheck = ({ text, toolCalls }) => {
  if (!/(você|voce) já tem|(você|voce) ja tem|you already (have|own)/i.test(text)) return null;
  const looked = toolCalls.some((call) => /^(get_collection|get_deck|get_owned_copies)\(/.test(call));
  return looked ? null : 'says the user already has cards without a collection or deck lookup';
};

const makeupWithNumbers: TEvalCheck = ({ text }) => {
  const missing = [/\b22\b/, /\b16\b/, /média|average/i].filter((pattern) => !pattern.test(text));
  return missing.length === 0 ? null : "does not compare the deck's 22 arrows and 16 buffs with the other decks' average";
};

function allOf(...checks: readonly TEvalCheck[]): TEvalCheck {
  return (outcome) => checks.map((check) => check(outcome)).find((failure) => failure !== null) ?? null;
}

function tileQuestions(deck: (typeof EVAL_DECKS)[number]): IEvalScenario[] {
  return [
    {
      id: `tile-tournaments-${deck.key}`,
      deck: deck.key,
      question: `Como outros jogam o ${deck.hero} nos torneios?`,
      locale: 'pt-BR',
      check: ownershipLookedUp,
    },
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
  {
    id: 'swap-keeps-role-azalea',
    deck: 'azalea',
    question: 'O que posso colocar no lugar das 2 Lace with Bloodrot? Pode ser carta fora da minha biblioteca.',
    locale: 'pt-BR',
    check: keepsRole('lace-with-bloodrot-red'),
  },
  {
    id: 'swap-cost-azalea',
    deck: 'azalea',
    question: 'Troque a Lace with Bloodrot por uma carta parecida.',
    locale: 'pt-BR',
    check: allOf(keepsRole('lace-with-bloodrot-red'), costSaid('lace-with-bloodrot-red')),
  },
  {
    id: 'swap-role-change-azalea',
    deck: 'azalea',
    question: 'Acho que meu deck está com muito buff. Veja mais flechas para entrar e quais cartas elas substituiriam.',
    locale: 'pt-BR',
    check: arrowsWhenAsked,
  },
  {
    id: 'makeup-compare-azalea',
    deck: 'azalea',
    question: 'Como está a proporção de buffs vs flechas no meu deck? Está parecida com a maioria dos outros decks de Azalea?',
    locale: 'pt-BR',
    check: makeupWithNumbers,
  },
  { id: 'swap-dead-card-azalea', deck: 'azalea', question: "O que usar no lugar do Bolt'n Boots?", locale: 'pt-BR', check: neverProposes('quick-clicks') },
];
