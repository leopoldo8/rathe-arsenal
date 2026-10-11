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
  it('replays done turns verbatim and trims whole exchanges', () => {
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
      ...toolTurn('first'),
      { role: 'user', parts: [{ text: 'second' }] },
      { role: 'model', parts: [{ text: 'plain' }] },
      { role: 'user', parts: [{ text: 'third' }, { text: 'now' }] },
    ]);
    expect(JSON.stringify(contents)).toContain(SIGNATURE);

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
    const calls = trimmed.flatMap((content) => content.parts).filter((part) => part.functionCall).map((part) => part.functionCall!.id);
    const responses = trimmed.flatMap((content) => content.parts).filter((part) => part.functionResponse).map((part) => part.functionResponse!.id);
    expect(calls).toEqual(responses);
  });
});
