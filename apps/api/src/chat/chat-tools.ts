import { IFunctionDeclaration } from './gemini-chat-client';

export const TOOL_STRING_MAX = 200;
export const TOOL_REASON_MAX = 1000;
export const TOOL_LIST_MAX = 50;
export const TOOL_LIMIT_MAX = 20;
export const DECK_PROPOSAL_ROWS_MAX = 80;
export const TOOL_RESULT_MAX_CHARS = 30_000;

export type TToolResult = Record<string, unknown>;

export class InvalidToolArguments extends Error {}
export class UnknownTool extends Error {}

const string = (description: string) => ({ type: 'string', description });
const integer = (description: string) => ({ type: 'integer', description });
const object = (properties: Record<string, unknown>, required: readonly string[]) => ({
  type: 'object',
  properties,
  required,
});
const cardRow = object(
  {
    cardIdentifier: string('Catalog card identifier.'),
    quantity: integer('Copies, at least 1.'),
    slot: { type: 'string', enum: ['mainboard', 'equipment', 'weapon'] },
  },
  ['cardIdentifier', 'quantity', 'slot'],
);

export const CHAT_TOOL_DECLARATIONS: readonly IFunctionDeclaration[] = [
  {
    name: 'get_deck',
    description:
      "One of the user's decks: hero, format, status, every card with slot, quantity, owned copies, pitch, text and legality, the counted totals (cards per slot, mainboard per pitch, card pool, illegal cards) and the format's limits. Quote these totals; never count by hand.",
    parametersJsonSchema: object({ deckId: integer('Deck id from the account summary.') }, ['deckId']),
  },
  {
    name: 'get_owned_copies',
    description: 'How many copies of each card the user owns in their collection.',
    parametersJsonSchema: object(
      { cardIdentifiers: { type: 'array', items: { type: 'string' }, description: 'At most 50 card identifiers.' } },
      ['cardIdentifiers'],
    ),
  },
  {
    name: 'search_cards',
    description:
      'Search the card catalog by name or rules text. With heroIdentifier and format, each card says whether it is legal for that hero and format.',
    parametersJsonSchema: object(
      {
        query: string('Words from the card name or rules text.'),
        heroIdentifier: string('Optional hero card identifier for legality.'),
        format: string('Optional format for legality.'),
        limit: integer('At most 20; default 10.'),
      },
      ['query'],
    ),
  },
  {
    name: 'get_recommendations',
    description: "The latest card recommendations computed for one of the user's decks.",
    parametersJsonSchema: object({ deckId: integer('Deck id.') }, ['deckId']),
  },
  {
    name: 'search_tournament_decks',
    description:
      'Tournament decks copied from Fabrary, newest first, with event name and placement when known. source "tournament" is event coverage Fabrary marks as a tournament deck; source "player-named" is a deck its owner named after an event and a placement, so it is player-reported. When nothing matches, the answer says so and lists related heroes and the heroes that have decks.',
    parametersJsonSchema: object(
      {
        heroIdentifier: string('Optional hero card identifier, exactly as in the user\'s deck list; a young hero and its adult version are different heroes.'),
        format: string('Optional format.'),
        since: string('Optional ISO date; only decks from this date on.'),
        limit: integer('At most 20; default 10.'),
      },
      [],
    ),
  },
  {
    name: 'get_tournament_meta',
    description:
      'Per hero, how many tournament decks one format has, how many placed top 8 and how many won, plus player-named decks, most decks first. Use it to rank heroes or describe the meta instead of counting a search sample.',
    parametersJsonSchema: object(
      { format: string('Format, for example "Classic Constructed".'), since: string('Optional ISO date; only decks from this date on.') },
      ['format'],
    ),
  },
  {
    name: 'get_tournament_deck',
    description: 'The full card list of one tournament deck with its source and date, each card\'s text and legality, and the counted totals.',
    parametersJsonSchema: object({ id: string('Tournament deck id from search_tournament_decks.') }, ['id']),
  },
  {
    name: 'search_rules',
    description: 'Search the Flesh and Blood comprehensive rules by rule number or words. Returns at most 8 rules.',
    parametersJsonSchema: object({ query: string('A rule number like 1.3.2 or words like "go again".') }, ['query']),
  },
  {
    name: 'propose_deck',
    description: 'Propose a new deck the user can create with one click. The server checks legality and copy limits.',
    parametersJsonSchema: object(
      {
        name: string('Deck name, at most 120 characters.'),
        heroIdentifier: string('Hero card identifier.'),
        format: string('Format.'),
        cards: { type: 'array', items: cardRow, description: 'At most 80 rows; the hero is not listed.' },
        reason: string('Why this deck, shown to the user.'),
      },
      ['name', 'heroIdentifier', 'format', 'cards', 'reason'],
    ),
  },
  {
    name: 'propose_swap',
    description: "Propose replacing every copy of one card in one of the user's decks with another card.",
    parametersJsonSchema: object(
      {
        deckId: integer('Deck id.'),
        originalCardIdentifier: string('The card to take out.'),
        slot: { type: 'string', enum: ['mainboard', 'equipment'] },
        replacementCardIdentifier: string('The card to put in.'),
        reason: string('Why, shown to the user.'),
      },
      ['deckId', 'originalCardIdentifier', 'slot', 'replacementCardIdentifier', 'reason'],
    ),
  },
];

export const CHAT_TOOL_NAMES: ReadonlySet<string> = new Set(CHAT_TOOL_DECLARATIONS.map((tool) => tool.name));

export function readString(args: Record<string, unknown>, key: string, options: { optional?: boolean; max?: number } = {}): string | undefined {
  const value = args[key];
  if (value === undefined || value === null || value === '') {
    if (options.optional) return undefined;
    throw new InvalidToolArguments(`${key} is required`);
  }
  if (typeof value !== 'string' || value.length > (options.max ?? TOOL_STRING_MAX)) {
    throw new InvalidToolArguments(`${key} must be a string of at most ${options.max ?? TOOL_STRING_MAX} characters`);
  }
  return value;
}

export function readInteger(args: Record<string, unknown>, key: string, options: { optional?: boolean; min?: number; max?: number } = {}): number | undefined {
  const value = args[key];
  if (value === undefined || value === null) {
    if (options.optional) return undefined;
    throw new InvalidToolArguments(`${key} is required`);
  }
  const number = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof number !== 'number' || !Number.isInteger(number) || number < (options.min ?? 0) || number > (options.max ?? 2_147_483_647)) {
    throw new InvalidToolArguments(`${key} must be an integer${options.max !== undefined ? ` of at most ${options.max}` : ''}`);
  }
  return number;
}

export function readList(args: Record<string, unknown>, key: string, max: number = TOOL_LIST_MAX): unknown[] {
  const value = args[key];
  if (!Array.isArray(value) || value.length > max) throw new InvalidToolArguments(`${key} must be a list of at most ${max} entries`);
  return value;
}

export function readLimit(args: Record<string, unknown>, fallback = 10): number {
  return readInteger(args, 'limit', { optional: true, min: 1, max: TOOL_LIMIT_MAX }) ?? fallback;
}

/** Keeps a function response under the size bound; a cut result is sent as a truncated JSON string. */
export function boundResult(result: TToolResult): TToolResult {
  const json = JSON.stringify(result);
  if (json.length <= TOOL_RESULT_MAX_CHARS) return result;
  const envelope = { truncated: true, partial: '' };
  const room = TOOL_RESULT_MAX_CHARS - JSON.stringify(envelope).length - 64;
  let partial = json.slice(0, room);
  while (JSON.stringify({ ...envelope, partial }).length > TOOL_RESULT_MAX_CHARS) partial = partial.slice(0, -100);
  return { ...envelope, partial };
}

export type TChatToolbox = Readonly<Record<string, (args: Record<string, unknown>) => Promise<TToolResult>>>;

export async function runChatTool(toolbox: TChatToolbox, name: string, args: Record<string, unknown>): Promise<TToolResult> {
  const tool = CHAT_TOOL_NAMES.has(name) ? toolbox[name] : undefined;
  if (!tool) throw new UnknownTool(name);
  try {
    return boundResult(await tool(args ?? {}));
  } catch (error) {
    if (error instanceof InvalidToolArguments) return { error: 'INVALID_ARGUMENTS', detail: error.message };
    throw error;
  }
}
