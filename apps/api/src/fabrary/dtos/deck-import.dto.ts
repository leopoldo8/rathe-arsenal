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
}
