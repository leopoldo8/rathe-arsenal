import { ICatalogCard, ICatalogIndices } from './types';

function pitchKey(cls: string, pitch: number | null): string {
  return `${cls}:${pitch}`;
}

function typeClassKey(type: string, cls: string): string {
  return `${type}:${cls}`;
}

function appendToMap<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const existing = map.get(key);
  if (existing) {
    existing.push(value);
  } else {
    map.set(key, [value]);
  }
}

export function buildIndices(cards: readonly ICatalogCard[]): ICatalogIndices {
  const byIdentifier = new Map<string, ICatalogCard>();
  const byClassAndPitch = new Map<string, ICatalogCard[]>();
  const byTypeAndClass = new Map<string, ICatalogCard[]>();
  const byName = new Map<string, ICatalogCard[]>();

  for (const card of cards) {
    byIdentifier.set(card.cardIdentifier, card);

    // Case-insensitive name index: key is name.toLowerCase().
    // Multiple cards can share a name (different pitch variants, different editions).
    appendToMap(byName, card.name.toLowerCase(), card);

    for (const cls of card.classes) {
      appendToMap(byClassAndPitch, pitchKey(cls, card.pitch), card);

      for (const type of card.types) {
        appendToMap(byTypeAndClass, typeClassKey(type, cls), card);
      }
    }

    // Cards with no classes still get indexed by type
    if (card.classes.length === 0) {
      for (const type of card.types) {
        appendToMap(byTypeAndClass, typeClassKey(type, ''), card);
      }
    }
  }

  // Freeze inner arrays to satisfy ReadonlyMap<string, readonly ICatalogCard[]>.
  for (const [key, arr] of byName) {
    byName.set(key, Object.freeze(arr) as ICatalogCard[]);
  }

  return { byIdentifier, byClassAndPitch, byTypeAndClass, byName };
}
