export function automaticDeckName(hero: string, format: string): string {
  return `${hero} - ${format}`;
}

/**
 * The name a deck should take when its format changes: the new automatic name if the deck still
 * carries the automatic name of its old format, otherwise undefined (the player named it).
 */
export function nameAfterFormatChange(
  deck: { readonly name: string; readonly hero: string; readonly format: string },
  nextFormat: string,
): string | undefined {
  if (deck.format === nextFormat) return undefined;
  return deck.name === automaticDeckName(deck.hero, deck.format) ? automaticDeckName(deck.hero, nextFormat) : undefined;
}
