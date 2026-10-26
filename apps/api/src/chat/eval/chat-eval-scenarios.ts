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
  /** The copies the proposal moves; absent for a proposal stored before swaps carried it. */
  readonly quantity?: number;
}

/** What one tool answered during the turn. */
export interface IEvalToolResult {
  readonly name: string;
  readonly result: Record<string, unknown>;
}

export interface IEvalOutcome {
  readonly text: string;
  readonly toolCalls: readonly string[];
  readonly swaps: readonly IEvalSwap[];
  /** Absent in a trace recorded before the eval read the tool answers. */
  readonly toolResults?: readonly IEvalToolResult[];
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

function textMatches(pattern: RegExp, failure: string): TEvalCheck {
  return ({ text }) => (pattern.test(text) ? null : failure);
}

function calledWith(tool: string, argument: RegExp | null, failure: string): TEvalCheck {
  return ({ toolCalls }) => (toolCalls.some((call) => call.startsWith(`${tool}(`) && (argument === null || argument.test(call))) ? null : failure);
}

/** The audit's F29: counting the pitches of one name together instead of each card (name and pitch) against its limit. */
const countsPitchesTogether = /somando os pitches|\b10 pack hunt|deixe 3 no total|ficar no limite pelo nome/i;

const copyRuleBySeparateCards: TEvalCheck = ({ text }) => {
  if (countsPitchesTogether.test(text)) return 'adds the pitches of one name together';
  return /vermelh|\bred\b/i.test(text) ? null : 'does not single out the red copies';
};

/** The audit's F34: the Tutor refused a one-copy fix and proposed nothing. */
const oneCopyProposed: TEvalCheck = ({ swaps, toolCalls }) => {
  if (!toolCalls.some((call) => call.startsWith('propose_swap(')) || swaps.length === 0) return 'proposed no swap for a one-copy fix';
  const moved = swaps.filter((swap) => swap.quantity !== undefined && swap.quantity !== 1);
  return moved.length === 0 ? null : `moved more than one copy: ${moved.map((swap) => `${swap.original} x${swap.quantity}`).join(', ')}`;
};

/** The audit's F30: every `get_prices` call answered `INVALID_ARGUMENTS`, so the answer had no price to stand on. */
const priceLookedUp: TEvalCheck = ({ toolResults = [] }) => {
  const prices = toolResults.filter((entry) => entry.name === 'get_prices');
  if (prices.length === 0) return 'did not look the prices up';
  return prices.some((entry) => entry.result['error'] === undefined) ? null : 'every get_prices call was refused';
};

const TOURNAMENT_TOOLS = /^(search_tournament_decks|get_tournament_deck|get_tournament_meta|get_community_decks)\(/;

/** Neither hero question can be answered from the model's memory: each needs data from a tool. */
const answeredFromTournamentData: TEvalCheck = ({ toolCalls }) =>
  toolCalls.some((call) => TOURNAMENT_TOOLS.test(call)) ? null : 'answered with no tournament lookup';

const nextHeroFromCollectionAndMeta: TEvalCheck = ({ toolCalls }) => {
  if (!toolCalls.some((call) => call.startsWith('get_collection('))) return 'did not look at what the user owns';
  return toolCalls.some((call) => TOURNAMENT_TOOLS.test(call)) ? null : 'did not look at the tournament data';
};

/** The audit's F33: `search_rules` answered `found: false` and the question stayed unanswered. */
const rulesFound: TEvalCheck = ({ toolResults = [] }) => {
  const searches = toolResults.filter((entry) => entry.name === 'search_rules');
  if (searches.length === 0) return 'did not search the rules';
  const found = (result: Record<string, unknown>): boolean =>
    result['found'] === true || (Array.isArray(result['results']) && result['results'].some((one: { found?: boolean }) => one.found === true));
  return searches.some((entry) => found(entry.result)) ? null : 'no rules search found a rule';
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
    { id: `tile-missing-${deck.key}`, deck: deck.key, question: 'O que ainda impede este deck de ficar pronto?', locale: 'pt-BR' },
  ];
}

export const EVAL_SCENARIOS: readonly IEvalScenario[] = [
  ...EVAL_DECKS.flatMap(tileQuestions),
  { id: 'ready-hero', deck: null, question: 'Como outras pessoas montam o Kano nos torneios?', locale: 'pt-BR', check: answeredFromTournamentData },
  { id: 'ready-next-hero', deck: null, question: 'Qual herói devo montar a seguir com as cartas que tenho?', locale: 'pt-BR', check: nextHeroFromCollectionAndMeta },
  { id: 'ready-triggers', deck: null, question: 'Explique a ordem dos gatilhos ao atacar', locale: 'pt-BR', check: rulesFound },
  {
    id: 'copy-rule-pack-hunt',
    deck: null,
    question:
      'Meu Rhinar CC tem 4 Pack Hunt (Vermelho), 3 Pack Hunt (Amarelo) e 3 Pack Hunt (Azul). O limite do Classic Constructed é 3 por carta. Quantas Pack Hunt eu preciso tirar?',
    locale: 'pt-BR',
    check: copyRuleBySeparateCards,
  },
  {
    id: 'one-copy-swap',
    deck: 'azalea',
    question: 'Quero trocar só 1 Lace with Bloodrot por uma carta parecida. Pode propor?',
    locale: 'pt-BR',
    check: oneCopyProposed,
  },
  {
    id: 'deck-price',
    deck: 'azalea',
    question: 'Quanto eu gasto na Cúpula DT para fechar este deck?',
    locale: 'pt-BR',
    check: priceLookedUp,
  },
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
  {
    id: 'makeup-range-azalea',
    deck: 'azalea',
    question: 'Minha proporção de flechas e buffs está dentro do que os outros decks de Azalea jogam? Me dê a faixa.',
    locale: 'pt-BR',
    check: allOf(makeupWithNumbers, textMatches(/m[ií]nimo|m[aá]ximo|menor|maior|limite|de \d+ a \d+|entre \d+ e \d+|\d+\s?[–-]\s?\d+/i, 'gives no lowest or highest of the other decks')),
  },
  {
    id: 'compare-cards-azalea',
    deck: 'azalea',
    question: 'Que cartas a maioria das listas de Azalea joga e eu não jogo?',
    locale: 'pt-BR',
    check: calledWith('get_community_decks', /compareDeckId/, 'did not compare the deck with the regular decks card by card'),
  },
  {
    id: 'defense-profile-azalea',
    deck: 'azalea',
    question: 'Meu deck defende bem? Quantas reações de defesa ele tem?',
    locale: 'pt-BR',
    check: textMatches(/nenhuma rea[cç][aã]o|\b0 rea[cç]|zero rea[cç]|n[aã]o tem (nenhuma )?rea[cç]|sem rea[cç][oõ]es de defesa/i, 'does not say the deck has no defense reactions'),
  },
  {
    id: 'resources-azalea',
    deck: 'azalea',
    question: 'Meu deck é caro demais? Quanto ele gasta de recursos?',
    locale: 'pt-BR',
    check: allOf(
      textMatches(/0[,.]2\b/, 'does not quote the average cost of 0.2'),
      textMatches(/Death Dealer|Crow.s Nest|Bolt.n Boots/i, 'does not name what the weapon or equipment spend'),
    ),
  },
  {
    id: 'draw-odds-azalea',
    deck: 'azalea',
    question: 'Qual a chance de eu abrir com pelo menos uma carta azul na mão inicial?',
    locale: 'pt-BR',
    check: allOf(calledWith('get_draw_odds', null, 'did not use the draw odds tool'), textMatches(/19[,.]?\d?\s?%/, 'does not give the 19% chance')),
  },
  {
    id: 'prices-azalea',
    deck: 'azalea',
    question: 'Quanto custa comprar o que ainda falta para este deck?',
    locale: 'pt-BR',
    check: calledWith('get_prices', null, 'did not look the prices up'),
  },
  { id: 'swap-dead-card-azalea', deck: 'azalea', question: "O que usar no lugar do Bolt'n Boots?", locale: 'pt-BR', check: neverProposes('quick-clicks') },
];
