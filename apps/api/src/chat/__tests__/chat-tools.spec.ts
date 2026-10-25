import { catalog } from '@rathe-arsenal/engine';
import { findCardsMatching } from '../card-search';
import {
  CHAT_TOOL_DECLARATIONS,
  readInteger,
  readList,
  readLimit,
  readQueries,
  readString,
  runChatTool,
  TChatToolbox,
  TOOL_QUERIES_MAX,
  TOOL_RESULT_MAX_CHARS,
} from '../chat-tools';

const stringTool = (args: Record<string, unknown>) => Promise.resolve({ value: readString(args, 'query') });
const listTool = (args: Record<string, unknown>) => Promise.resolve({ size: readList(args, 'cardIdentifiers').length });
const limitTool = (args: Record<string, unknown>) => Promise.resolve({ limit: readLimit(args) });
const intTool = (args: Record<string, unknown>) => Promise.resolve({ id: readInteger(args, 'deckId', { min: 1 }) });

describe('chat tools', () => {
  it('every tool bounds its input and its result', async () => {
    const toolbox: TChatToolbox = {
      search_rules: stringTool,
      get_owned_copies: listTool,
      search_cards: limitTool,
      get_deck: intTool,
      search_tournament_decks: async () => ({ decks: Array.from({ length: 500 }, (_, i) => ({ id: i, name: 'x'.repeat(100) })) }),
    };
    const cases: Array<[string, Record<string, unknown>]> = [
      ['search_rules', { query: 'a'.repeat(201) }],
      ['get_owned_copies', { cardIdentifiers: Array.from({ length: 51 }, () => 'flex-red') }],
      ['search_cards', { query: 'flex', limit: 21 }],
      ['get_deck', { deckId: 'abc' }],
    ];

    const refused = await Promise.all(cases.map(([name, args]) => runChatTool(toolbox, name, args)));
    const accepted = await Promise.all([
      runChatTool(toolbox, 'search_rules', { query: 'a'.repeat(200) }),
      runChatTool(toolbox, 'get_owned_copies', { cardIdentifiers: Array.from({ length: 50 }, () => 'flex-red') }),
      runChatTool(toolbox, 'search_cards', { query: 'flex', limit: 20 }),
    ]);
    const big = await runChatTool(toolbox, 'search_tournament_decks', {});

    expect(refused.map((result) => result['error'])).toEqual(cases.map(() => 'INVALID_ARGUMENTS'));
    expect(accepted.map((result) => result['error'])).toEqual([undefined, undefined, undefined]);
    expect(JSON.stringify(big).length).toBeLessThanOrEqual(TOOL_RESULT_MAX_CHARS);
    expect(big['truncated']).toBe(true);
    expect(CHAT_TOOL_DECLARATIONS.map((tool) => tool.name)).toHaveLength(15);
    expect(TOOL_RESULT_MAX_CHARS).toBe(30_000);
  });

  it('a search takes one query or a list of up to eight', async () => {
    const toolbox: TChatToolbox = { search_cards: async (args) => ({ queries: readQueries(args) }) };
    const refused = [
      {},
      { queries: [] },
      { queries: Array.from({ length: TOOL_QUERIES_MAX + 1 }, () => 'flex') },
      { queries: ['flex', 3] },
      { queries: ['flex', ' '] },
      { queries: ['a'.repeat(201)] },
    ];

    const results = await Promise.all(refused.map((args) => runChatTool(toolbox, 'search_cards', args)));

    expect(results.map((result) => result['error'])).toEqual(refused.map(() => 'INVALID_ARGUMENTS'));
    expect(await runChatTool(toolbox, 'search_cards', { query: 'flex' })).toEqual({ queries: ['flex'] });
    expect(await runChatTool(toolbox, 'search_cards', { queries: ['flex', 'coax'] })).toEqual({ queries: ['flex', 'coax'] });
    expect(TOOL_QUERIES_MAX).toBe(8);
  });

  it('search_cards matches type, class and talent as well as name and text', () => {
    const names = (query: string): string[] => findCardsMatching(catalog.cards, query).map((card) => card.name);

    expect(names('Brute weapon')).toContain('Romping Club');

    // One card picked by each field's value, whose name does not contain the query.
    const byField = [
      ['type', (card: (typeof catalog.cards)[number]) => card.types[0]],
      ['class', (card: (typeof catalog.cards)[number]) => card.classes[0]],
      ['talent', (card: (typeof catalog.cards)[number]) => card.talents[0]],
    ] as const;
    for (const [field, valueOf] of byField) {
      const picked = catalog.cards.find((card) => {
        const value = valueOf(card);
        return value !== undefined && !card.name.toLowerCase().includes(String(value).toLowerCase());
      })!;
      const value = String(valueOf(picked));
      expect({ field, value, found: findCardsMatching(catalog.cards, value).some((card) => card.cardIdentifier === picked.cardIdentifier) }).toEqual({ field, value, found: true });
    }
  });

  it('search_cards still ranks a name match before a rules text match', () => {
    const found = findCardsMatching(catalog.cards, 'pummel');

    expect(found[0]!.name.toLowerCase()).toContain('pummel');
  });

  it('get_swap_candidates declares an optional integer quantity', () => {
    const declaration = CHAT_TOOL_DECLARATIONS.find((tool) => tool.name === 'get_swap_candidates')!;
    const schema = declaration.parametersJsonSchema as { properties: Record<string, { type: string }>; required: string[] };

    expect(schema.properties['quantity']?.type).toBe('integer');
    expect(schema.required).not.toContain('quantity');
  });
});
