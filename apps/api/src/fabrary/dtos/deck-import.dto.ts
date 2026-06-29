export interface IDeckCardEntry {
  readonly cardIdentifier: string;
  readonly quantity: number;
  readonly slot: 'mainboard' | 'equipment' | 'weapon' | 'hero';
}

export interface IDeckImportDto {
  readonly ulid: string;
  readonly name: string;
  readonly format: string;
  readonly hero: { readonly cardIdentifier: string; readonly name: string };
  readonly mainboard: readonly IDeckCardEntry[];
  readonly equipment: readonly IDeckCardEntry[];
  readonly weapons: readonly IDeckCardEntry[];
  /**
   * Cards in the deck's "Inventory" section on Fabrary. Fabrary's API
   * exposes these as `sideboardQuantity` (the section is labelled
   * "Inventory" in its UI, not "Sideboard"), holding extra copies the
   * owner keeps for the deck. They feed the library import but are
   * intentionally excluded from the tracked-deck card list.
   *
   * The deck's "Maybe" section (`maybeQuantity`) is never fetched, so it
   * never appears here and is never imported.
   */
  readonly inventory: readonly IDeckCardEntry[];
}
