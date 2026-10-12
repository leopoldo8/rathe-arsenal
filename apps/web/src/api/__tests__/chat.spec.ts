import { describe, it, expect } from 'vitest';
import { chatRefetchInterval, conversationPath, type IChatConversation, type IChatMessage, type TChatMessageStatus } from '../chat';

function message(role: 'user' | 'assistant', status: TChatMessageStatus): IChatMessage {
  return { id: `${role}-${status}`, role, status, text: null, error: null, proposals: [], createdAt: '2026-10-11T10:00:00.000Z' };
}

function conversation(messages: IChatMessage[]): IChatConversation {
  return { id: 'c-1', title: 'Katsu', trackedDeckId: null, updatedAt: '2026-10-11T10:00:00.000Z', messages };
}

describe('chatRefetchInterval', () => {
  it('polls only while a turn is open', () => {
    const asked = message('user', 'done');

    const intervals = [
      chatRefetchInterval(conversation([asked, message('assistant', 'pending')])),
      chatRefetchInterval(conversation([asked, message('assistant', 'running')])),
      chatRefetchInterval(conversation([asked, message('assistant', 'done')])),
      chatRefetchInterval(conversation([asked, message('assistant', 'failed')])),
      chatRefetchInterval(conversation([])),
      chatRefetchInterval(undefined),
    ];

    expect(intervals).toEqual([3000, 3000, false, false, false, false]);
  });
});

describe('conversationPath', () => {
  it('encodes the id so a URL cannot reach another API route', () => {
    expect(conversationPath('../../decks/5')).toBe('/chat/conversations/..%2F..%2Fdecks%2F5');
  });
});
