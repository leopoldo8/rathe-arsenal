export interface IChatSearch {
  readonly deck?: number;
}

export function validateChatSearch(raw: Record<string, unknown>): IChatSearch {
  const deck = typeof raw.deck === 'string' ? Number(raw.deck) : raw.deck;
  return typeof deck === 'number' && Number.isInteger(deck) && deck > 0 ? { deck } : {};
}
