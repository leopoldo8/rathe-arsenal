import { TGeminiFetch } from '../../recommendations/gemini-client';
import { ANSWER_NOW_INSTRUCTION, buildChatBody, IChatRequest, IGeminiContent } from '../gemini-chat-client';
import { buildOpenRouterBody, callOpenRouterChat, classifyOpenRouterAnswer, OPENROUTER_URL, toOpenRouterMessages } from '../openrouter-chat-client';

const MODEL = 'anthropic/claude-haiku-5.5';
const TOOLS = [{ name: 'get_deck', description: 'A deck.', parametersJsonSchema: { type: 'object', properties: {}, required: [] } }];
const USAGE = { prompt_tokens: 900, completion_tokens: 40, prompt_tokens_details: { cached_tokens: 600 }, cost: 0.00012 };

function respond(status: number, body: unknown = {}): TGeminiFetch {
  return async () => ({ ok: status >= 200 && status < 300, status, json: async () => body });
}

function choice(message: Record<string, unknown>, finishReason = 'stop'): Record<string, unknown> {
  return { choices: [{ finish_reason: finishReason, message: { role: 'assistant', ...message } }], usage: USAGE };
}

describe('OpenRouter chat client', () => {
  it('turns stored Gemini contents into chat messages, pairing calls Gemini left without ids in order', () => {
    const contents: IGeminiContent[] = [
      { role: 'user', parts: [{ text: 'Which card?' }] },
      {
        role: 'model',
        parts: [
          { text: 'thinking', thought: true },
          { functionCall: { name: 'get_deck', args: { deckId: 1 } }, thoughtSignature: 'sig' },
          { functionCall: { name: 'search_cards', args: { query: 'flex' } } },
        ],
      },
      {
        role: 'user',
        parts: [
          { functionResponse: { name: 'get_deck', response: { cards: [] } } },
          { functionResponse: { name: 'search_cards', response: { cards: ['flex'] } } },
        ],
      },
      { role: 'model', parts: [{ reasoningDetails: [{ type: 'reasoning.encrypted', data: 'x' }] }, { functionCall: { id: 'or-1', name: 'get_deck', args: {} } }] },
      { role: 'user', parts: [{ functionResponse: { id: 'or-1', name: 'get_deck', response: { ok: true } } }] },
      { role: 'model', parts: [{ text: 'Swap Flex.' }] },
    ];

    const messages = toOpenRouterMessages('system text', contents);

    expect(messages).toEqual([
      { role: 'system', content: 'system text' },
      { role: 'user', content: 'Which card?' },
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          { id: 'call_1_1', type: 'function', function: { name: 'get_deck', arguments: '{"deckId":1}' } },
          { id: 'call_1_2', type: 'function', function: { name: 'search_cards', arguments: '{"query":"flex"}' } },
        ],
      },
      { role: 'tool', tool_call_id: 'call_1_1', content: '{"cards":[]}' },
      { role: 'tool', tool_call_id: 'call_1_2', content: '{"cards":["flex"]}' },
      {
        role: 'assistant',
        content: null,
        tool_calls: [{ id: 'or-1', type: 'function', function: { name: 'get_deck', arguments: '{}' } }],
        reasoning_details: [{ type: 'reasoning.encrypted', data: 'x' }],
      },
      { role: 'tool', tool_call_id: 'or-1', content: '{"ok":true}' },
      { role: 'assistant', content: 'Swap Flex.' },
    ]);
  });

  it('declares the tools, keeps data collection off, and on a final call sends no tool and only text', () => {
    const request: IChatRequest = {
      system: 's',
      contents: [
        { role: 'user', parts: [{ text: 'q' }] },
        { role: 'model', parts: [{ functionCall: { id: 'a', name: 'get_deck', args: {} } }] },
        { role: 'user', parts: [{ functionResponse: { id: 'a', name: 'get_deck', response: { cards: [] } } }] },
      ],
      tools: TOOLS,
    };

    const body = buildOpenRouterBody(MODEL, request, 'low');
    const final = buildOpenRouterBody(MODEL, { ...request, answerNow: true });

    expect(body).toEqual(
      expect.objectContaining({
        model: MODEL,
        tools: [{ type: 'function', function: { name: 'get_deck', description: 'A deck.', parameters: TOOLS[0]!.parametersJsonSchema } }],
        reasoning: { effort: 'low' },
        provider: { data_collection: 'deny' },
      }),
    );
    expect(final['tools']).toBeUndefined();
    expect(final['reasoning']).toBeUndefined();
    const messages = final['messages'] as Array<Record<string, unknown>>;
    expect(messages.every((message) => message['role'] === 'system' || message['role'] === 'user' || message['role'] === 'assistant')).toBe(true);
    expect(messages.some((message) => 'tool_calls' in message)).toBe(false);
    expect(String(messages[0]!['content'])).toContain(ANSWER_NOW_INSTRUCTION);
    expect(String(messages[messages.length - 1]!['content'])).toContain(ANSWER_NOW_INSTRUCTION);
  });

  it('reads text, tool calls, reasoning to send back, and the usage with the cost OpenRouter charged', () => {
    const outcome = classifyOpenRouterAnswer(
      choice(
        {
          content: 'Let me check.',
          tool_calls: [{ id: 'c1', type: 'function', function: { name: 'get_deck', arguments: '{"deckId":2}' } }],
          reasoning_details: [{ type: 'reasoning.text', text: 'hm', signature: 's' }],
        },
        'tool_calls',
      ),
    );

    expect(outcome).toEqual({
      kind: 'answer',
      text: 'Let me check.',
      calls: [{ id: 'c1', name: 'get_deck', args: { deckId: 2 } }],
      content: {
        role: 'model',
        parts: [
          { reasoningDetails: [{ type: 'reasoning.text', text: 'hm', signature: 's' }] },
          { text: 'Let me check.' },
          { functionCall: { id: 'c1', name: 'get_deck', args: { deckId: 2 } } },
        ],
      },
      usage: { inputTokens: 900, outputTokens: 40, cachedInputTokens: 600, costUsd: 0.00012 },
    });
  });

  it('classifies every answer that is not usable', () => {
    const code = (json: Record<string, unknown>): string => {
      const outcome = classifyOpenRouterAnswer(json);
      return outcome.kind === 'failed' ? outcome.code : 'answer';
    };

    expect(code(choice({ content: 'cut' }, 'length'))).toBe('MODEL_TRUNCATED');
    expect(code(choice({ content: 'no' }, 'content_filter'))).toBe('MODEL_REFUSED');
    expect(code(choice({ content: '' }))).toBe('MODEL_EMPTY');
    expect(code(choice({ content: null, tool_calls: [{ id: 'c', type: 'function', function: { name: 'get_deck', arguments: '{bad' } }] }))).toBe(
      'MODEL_BAD_TOOL_CALL',
    );
    expect(code({ choices: [] })).toBe('MODEL_EMPTY');
    expect(code({ error: { code: 429, message: 'slow down' } })).toBe('RATE_LIMITED');
    expect(code({ error: { code: 502, message: 'upstream' } })).toBe('PROVIDER_UNAVAILABLE');
    expect(code({ error: { code: 402, message: 'credits' } })).toBe('PROVIDER_ERROR');
    expect(code(choice({ content: [{ type: 'text', text: 'parts' }] }))).toBe('answer');
  });

  it('posts to OpenRouter with the key as a bearer token and maps HTTP failures', async () => {
    const seen: Array<{ url: string; headers: Record<string, string> }> = [];
    const fetchImpl: TGeminiFetch = async (url, init) => {
      seen.push({ url, headers: init.headers });
      return { ok: true, status: 200, json: async () => choice({ content: 'hi' }) };
    };
    const request: IChatRequest = { system: 's', contents: [{ role: 'user', parts: [{ text: 'q' }] }], tools: TOOLS };

    const outcome = await callOpenRouterChat('key', MODEL, request, fetchImpl);
    const statuses = await Promise.all([429, 402, 503].map((status) => callOpenRouterChat('key', MODEL, request, respond(status, { error: { message: 'm' } }))));

    expect(outcome).toEqual(expect.objectContaining({ kind: 'answer', text: 'hi' }));
    expect(seen[0]).toEqual({ url: OPENROUTER_URL, headers: expect.objectContaining({ Authorization: 'Bearer key' }) });
    expect(statuses.map((result) => (result.kind === 'failed' ? result.code : 'answer'))).toEqual(['RATE_LIMITED', 'PROVIDER_ERROR', 'PROVIDER_UNAVAILABLE']);
  });

  it('the Gemini client drops what OpenRouter stored for its own replay', () => {
    const body = buildChatBody({
      system: 's',
      contents: [{ role: 'model', parts: [{ reasoningDetails: [{ type: 'reasoning.text' }] }, { text: 'ok' }] }],
      tools: [],
    });

    expect(body['contents']).toEqual([{ role: 'model', parts: [{ text: 'ok' }] }]);
  });
});
