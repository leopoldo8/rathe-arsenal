import { buildHistory, IHistoryMessage } from '../chat-history';
import { IGeminiContent } from '../gemini-chat-client';

const SIGNATURE = 'CiQBVKhc7h+opaque/signature==';

function toolTurn(question: string): IGeminiContent[] {
  return [
    { role: 'model', parts: [{ functionCall: { id: `call-${question}`, name: 'get_deck', args: { deckId: 1 } }, thoughtSignature: SIGNATURE }] },
    { role: 'user', parts: [{ functionResponse: { id: `call-${question}`, name: 'get_deck', response: { cards: [] } } }] },
    { role: 'model', parts: [{ text: `answer to ${question}` }] },
  ];
}

describe('chat history', () => {
  it('keeps only the text of earlier exchanges, so a follow-up re-reads data with the tools, and trims whole exchanges', () => {
    const messages: IHistoryMessage[] = [
      { role: 'user', status: 'done', text: 'first', modelContent: null },
      { role: 'assistant', status: 'done', text: 'answer to first', modelContent: toolTurn('first') },
      { role: 'user', status: 'done', text: 'second', modelContent: null },
      { role: 'assistant', status: 'done', text: 'answer to second', modelContent: [{ role: 'model', parts: [{ text: 'plain' }] }] },
      { role: 'user', status: 'done', text: 'third', modelContent: null },
      { role: 'assistant', status: 'failed', text: null, modelContent: null },
      { role: 'user', status: 'done', text: 'now', modelContent: null },
    ];

    const contents = buildHistory(messages);

    expect(contents).toEqual([
      { role: 'user', parts: [{ text: 'first' }] },
      { role: 'model', parts: [{ text: 'answer to first' }] },
      { role: 'user', parts: [{ text: 'second' }] },
      { role: 'model', parts: [{ text: 'plain' }] },
      { role: 'user', parts: [{ text: 'third' }, { text: 'now' }] },
    ]);
    const followUp = buildHistory([...messages.slice(0, 2), { role: 'user', status: 'done', text: 'and then?', modelContent: null }]);
    expect(followUp).toEqual([
      { role: 'user', parts: [{ text: 'first' }] },
      { role: 'model', parts: [{ text: 'answer to first' }] },
      { role: 'user', parts: [{ text: 'and then?' }] },
    ]);
    expect(JSON.stringify(followUp)).not.toContain(SIGNATURE);

    const bulky: IHistoryMessage[] = [
      { role: 'user', status: 'done', text: 'x'.repeat(160_000), modelContent: null },
      { role: 'assistant', status: 'done', text: 'a', modelContent: toolTurn('old') },
      { role: 'user', status: 'done', text: 'recent', modelContent: null },
      { role: 'assistant', status: 'done', text: 'b', modelContent: toolTurn('recent') },
      { role: 'user', status: 'done', text: 'now', modelContent: null },
    ];
    const trimmed = buildHistory(bulky);

    expect(trimmed[0]).toEqual({ role: 'user', parts: [{ text: 'recent' }] });
    expect(trimmed[trimmed.length - 1]).toEqual({ role: 'user', parts: [{ text: 'now' }] });
    const exchange = (text: string): IHistoryMessage[] => [
      { role: 'user', status: 'done', text, modelContent: null },
      { role: 'assistant', status: 'done', text: 'a', modelContent: [{ role: 'model', parts: [{ text: 'a' }] }] },
    ];
    const current: IHistoryMessage = { role: 'user', status: 'done', text: 'now', modelContent: null };
    const sizedTo = (tokens: number): IHistoryMessage[] => {
      const base = buildHistory([...exchange(''), current], Number.MAX_SAFE_INTEGER);
      const padding = tokens * 4 - JSON.stringify(base).length;
      return [...exchange('p'.repeat(padding)), current];
    };
    expect(buildHistory(sizedTo(30_000))).toHaveLength(3);
    expect(buildHistory(sizedTo(30_001))).toEqual([{ role: 'user', parts: [{ text: 'now' }] }]);
    const calls = trimmed.flatMap((content) => content.parts).filter((part) => part.functionCall).map((part) => part.functionCall!.id);
    const responses = trimmed.flatMap((content) => content.parts).filter((part) => part.functionResponse).map((part) => part.functionResponse!.id);
    expect(calls).toEqual(responses);
  });
});
