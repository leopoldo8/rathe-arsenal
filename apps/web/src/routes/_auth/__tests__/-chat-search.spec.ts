import { describe, it, expect } from 'vitest';
import { validateChatSearch } from '../-chat-search';

describe('validateChatSearch', () => {
  it('reads the deck a draft is bound to', () => {
    const results = [{ deck: 7 }, { deck: '7' }, { deck: 'abc' }, { deck: -1 }, { deck: 1.5 }, { deck: 0 }, {}].map((raw) => validateChatSearch(raw));

    expect(results).toEqual([{ deck: 7 }, { deck: 7 }, {}, {}, {}, {}, {}]);
  });
});
