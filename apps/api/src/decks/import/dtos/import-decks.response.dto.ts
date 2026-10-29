export interface IImportedSource {
  readonly id: string;
  readonly kind: string;
  readonly label: string;
  readonly cardCount: number;
  readonly copies: number;
}

export interface IImportDecksResponse {
  readonly deckId: number;
  /** The import that holds the deck's cards; present only when the player said the cards are theirs. */
  readonly source?: IImportedSource;
}

export interface IFabraryDeckPreview {
  readonly name: string;
  readonly hero: string;
  readonly format: string;
  /** Copies in the deck and its inventory, hero included. */
  readonly totalCards: number;
  /** Of those copies, how many the active collection already holds. */
  readonly ownedCards: number;
}
