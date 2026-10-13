import { MAX_MODEL_CALLS, REPEATED_CALL_NOTE, runTurn } from '../chat-turn';
import { runChatTool, UnknownTool } from '../chat-tools';
import { IChatRequest, TChatCallOutcome } from '../gemini-chat-client';

function callAnswer(name: string): TChatCallOutcome {
  return {
    kind: 'answer',
    content: { role: 'model', parts: [{ functionCall: { name, args: {} } }] },
    calls: [{ id: undefined, name, args: {} }],
    text: '',
    usage: { inputTokens: 1, outputTokens: 1 },
  };
}

function textAnswer(text: string): TChatCallOutcome {
  return { kind: 'answer', content: { role: 'model', parts: [{ text }] }, calls: [], text, usage: { inputTokens: 1, outputTokens: 1 } };
}

function scriptedCall(answer: (request: IChatRequest, index: number) => TChatCallOutcome, onCall: () => void = () => undefined) {
  const requests: IChatRequest[] = [];
  const call = async (request: IChatRequest): Promise<TChatCallOutcome> => {
    requests.push(request);
    onCall();
    return answer(request, requests.length - 1);
  };
  return { call, requests };
}

const QUIET = { system: 's', history: [], recordUsage: async () => undefined, runTool: async () => ({}) };

describe('chat turn', () => {
  it('the last allowed call must answer in text', async () => {
    const script = scriptedCall((request) => (request.answerNow ? textAnswer('Here is what I found.') : callAnswer('search_tournament_decks')));

    const result = await runTurn({ ...QUIET, call: script.call, now: () => 0 });

    expect(MAX_MODEL_CALLS).toBe(5);
    expect(result).toEqual(expect.objectContaining({ kind: 'done', text: 'Here is what I found.', calls: 5 }));
    expect(script.requests.map((request) => request.answerNow === true)).toEqual([false, false, false, false, true]);
  });

  it('a call made with less than 200 seconds of the turn left must answer in text', async () => {
    let clock = 0;
    const script = scriptedCall(
      (request) => (request.answerNow ? textAnswer('ok') : callAnswer('get_deck')),
      () => {
        clock += 165_000;
      },
    );

    const result = await runTurn({ ...QUIET, call: script.call, now: () => clock });

    expect(result).toEqual(expect.objectContaining({ kind: 'done', calls: 3 }));
    expect(script.requests.map((request) => request.answerNow === true)).toEqual([false, false, true]);
  });

  it('a final call that still asks for a tool is asked once more, then fails the turn', async () => {
    const script = scriptedCall(() => callAnswer('get_collection'));

    const result = await runTurn({ ...QUIET, call: script.call, now: () => 0 });

    expect(result).toEqual(expect.objectContaining({ kind: 'failed', code: 'TOO_MANY_TOOL_ROUNDS', calls: MAX_MODEL_CALLS + 1 }));
    expect(script.requests.slice(MAX_MODEL_CALLS - 1).map((request) => request.answerNow)).toEqual([true, true]);
  });

  it('a final call that asks for a tool on its first try and answers on its second ends the turn done', async () => {
    let finals = 0;
    const script = scriptedCall((request) => {
      if (!request.answerNow) return callAnswer('get_deck');
      finals += 1;
      return finals === 1 ? callAnswer('get_collection') : textAnswer('Second try.');
    });

    const result = await runTurn({ ...QUIET, call: script.call, now: () => 0 });

    expect(result).toEqual(expect.objectContaining({ kind: 'done', text: 'Second try.', calls: MAX_MODEL_CALLS + 1 }));
  });

  it('a final call that writes text beside a tool call keeps the text', async () => {
    const script = scriptedCall((request) =>
      request.answerNow
        ? { ...callAnswer('get_collection'), text: 'Swap Flex for Coax.', content: { role: 'model', parts: [{ text: 'Swap Flex for Coax.' }, { functionCall: { name: 'get_collection', args: {} } }] } }
        : callAnswer('get_deck'),
    );

    const result = await runTurn({ ...QUIET, call: script.call, now: () => 0 });

    expect(result).toEqual(expect.objectContaining({ kind: 'done', text: 'Swap Flex for Coax.', calls: MAX_MODEL_CALLS }));
  });

  it('a call repeated with the same arguments is answered with a note instead of running the tool again', async () => {
    const runTool = jest.fn(async () => ({ cards: ['a'] }));
    const script = scriptedCall((request, index) => {
      if (index === 2) return textAnswer('done');
      return {
        ...callAnswer('get_deck'),
        content: { role: 'model', parts: [{ functionCall: { name: 'get_deck', args: { deckId: 1 } } }] },
        calls: [{ id: `c${index}`, name: 'get_deck', args: { deckId: 1 } }],
      };
    });

    const result = await runTurn({ ...QUIET, runTool, call: script.call, now: () => 0 });

    expect(result).toEqual(expect.objectContaining({ kind: 'done', calls: 3 }));
    expect(runTool).toHaveBeenCalledTimes(1);
    const responses = script.requests[2]!.contents.flatMap((content) => content.parts).flatMap((part) => (part.functionResponse ? [part.functionResponse] : []));
    expect(responses).toEqual([
      { id: 'c0', name: 'get_deck', response: { cards: ['a'] } },
      { id: 'c1', name: 'get_deck', response: { note: REPEATED_CALL_NOTE } },
    ]);
  });

  it('adds up the tokens every call read from the cache', async () => {
    const script = scriptedCall((_request, index) => {
      const usage = { inputTokens: 1_000, outputTokens: 10, cachedInputTokens: index * 400 };
      return index === 0 ? { ...callAnswer('get_deck'), usage } : { ...textAnswer('ok'), usage };
    });

    const result = await runTurn({ ...QUIET, call: script.call, now: () => 0 });

    expect(result.usage).toEqual({ inputTokens: 2_000, outputTokens: 20, cachedInputTokens: 400 });
  });

  it('a call that times out after a tool round gets one call that must answer', async () => {
    let clock = 0;
    const script = scriptedCall((request, index) => {
      if (request.answerNow) return textAnswer('Answer from what I had.');
      if (index === 0) return callAnswer('get_deck');
      clock += 120_000;
      return { kind: 'failed', code: 'MODEL_TIMEOUT', detail: 'no answer in 120000 ms' };
    });

    const result = await runTurn({ ...QUIET, call: script.call, now: () => clock });

    expect(result).toEqual(expect.objectContaining({ kind: 'done', text: 'Answer from what I had.', calls: 3 }));
    expect(script.requests.map((request) => request.answerNow === true)).toEqual([false, false, true]);
  });

  it('a first call that times out is made once more', async () => {
    let clock = 0;
    const script = scriptedCall((_request, index) => {
      if (index > 0) return textAnswer('Second try.');
      clock += 180_000;
      return { kind: 'failed', code: 'MODEL_TIMEOUT', detail: 'no answer in 180000 ms' };
    });

    const result = await runTurn({ ...QUIET, call: script.call, now: () => clock });

    expect(result).toEqual(expect.objectContaining({ kind: 'done', text: 'Second try.', calls: 2 }));
    expect(script.requests[1]!.answerNow).toBeUndefined();
  });

  it('a first call that times out twice fails the turn', async () => {
    const script = scriptedCall(() => ({ kind: 'failed', code: 'MODEL_TIMEOUT', detail: 'no answer in 180000 ms' }));

    const result = await runTurn({ ...QUIET, call: script.call, now: () => 0 });

    expect(result).toEqual(expect.objectContaining({ kind: 'failed', code: 'MODEL_TIMEOUT', calls: 2 }));
  });

  it('a turn past 480 seconds stops', async () => {
    const callsBeforeStop = async (elapsedAfterFirstCall: number): Promise<number> => {
      let clock = 0;
      let calls = 0;
      const call = async (): Promise<TChatCallOutcome> => {
        calls += 1;
        if (calls > 1) return { kind: 'failed', code: 'PROVIDER_ERROR', detail: 'stop' };
        clock = elapsedAfterFirstCall;
        return callAnswer('get_deck');
      };
      await runTurn({ system: 's', history: [], call, recordUsage: async () => undefined, runTool: async () => ({}), now: () => clock });
      return calls;
    };
    expect(await callsBeforeStop(479_999)).toBe(2);
    expect(await callsBeforeStop(480_000)).toBe(1);

    let clock = 0;
    const call = jest.fn(async () => {
      clock += 300_000;
      return callAnswer('get_deck');
    });

    const result = await runTurn({
      system: 's',
      history: [],
      call,
      recordUsage: async () => undefined,
      runTool: async () => ({}),
      now: () => clock,
    });

    expect(result).toEqual(expect.objectContaining({ kind: 'failed', code: 'TURN_TIMEOUT' }));
    expect(call).toHaveBeenCalledTimes(2);
  });

  it('an undeclared function fails the turn', async () => {
    const result = await runTurn({
      system: 's',
      history: [],
      call: async () => callAnswer('drop_table'),
      recordUsage: async () => undefined,
      runTool: (name, args) => runChatTool({ get_deck: async () => ({}) }, name, args),
      now: () => 0,
    });

    expect(result).toEqual(expect.objectContaining({ kind: 'failed', code: 'MODEL_BAD_TOOL_CALL' }));
    await expect(runChatTool({}, 'drop_table', {})).rejects.toBeInstanceOf(UnknownTool);
    await expect(runChatTool({ drop_table: async () => ({}) }, 'drop_table', {})).rejects.toBeInstanceOf(UnknownTool);
  });
});
