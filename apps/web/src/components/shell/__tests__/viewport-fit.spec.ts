import { describe, it, expect } from 'vitest';
import { fitsViewport } from '../viewport-fit';

describe('fitsViewport', () => {
  it('fits the chat routes to the viewport and leaves every other page scrolling', () => {
    expect(['/chat', '/chat/abc', '/home', '/decks/7', '/chatter'].map(fitsViewport)).toEqual([true, true, false, false, false]);
  });
});
