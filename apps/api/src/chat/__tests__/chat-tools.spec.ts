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
    expect(CHAT_TOOL_DECLARATIONS.map((tool) => tool.name)).toHaveLength(13);
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
});
