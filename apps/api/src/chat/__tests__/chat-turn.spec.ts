import { runTurn } from '../chat-turn';
import { runChatTool, UnknownTool } from '../chat-tools';
import { TChatCallOutcome } from '../gemini-chat-client';

function callAnswer(name: string): TChatCallOutcome {
  return {
    kind: 'answer',
    content: { role: 'model', parts: [{ functionCall: { name, args: {} } }] },
    calls: [{ id: undefined, name, args: {} }],
    text: '',
    usage: { inputTokens: 1, outputTokens: 1 },
  };
}

describe('chat turn', () => {
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
