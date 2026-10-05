import { describe, it, expect } from 'vitest';
import { humanizeCardIdentifier } from '../humanize-card-identifier';

describe('humanizeCardIdentifier', () => {
  it.each([
    ['emissary-of-tides-red', 'Emissary of Tides'],
    ['coax-a-commotion-red', 'Coax a Commotion'],
    ['the-hand-that-pulls-the-strings-blue', 'The Hand That Pulls the Strings'],
    ['katsu-the-wanderer', 'Katsu the Wanderer'],
    ['flex', 'Flex'],
  ])('turns %s into %s', (identifier, name) => {
    expect(humanizeCardIdentifier(identifier)).toBe(name);
  });
});
