import type { IProduct } from '../../../api/products';

export const KAYO: IProduct = {
  key: 'armory-kayo',
  name: 'Armory Deck: Kayo',
  kind: 'armory',
  format: 'Classic Constructed',
  cardCount: 66,
  hero: {
    cardIdentifier: 'kayo-armed-and-dangerous',
    name: 'Kayo, Armed and Dangerous',
    imageUrl: { small: 'https://img.test/AKO001-small.webp', large: 'https://img.test/AKO001-large.webp' },
  },
  cards: [
    { cardIdentifier: 'kayo-armed-and-dangerous', name: 'Kayo, Armed and Dangerous', pitch: null, quantity: 1 },
    { cardIdentifier: 'bare-fangs-red', name: 'Bare Fangs', pitch: 1, quantity: 3 },
  ],
};
