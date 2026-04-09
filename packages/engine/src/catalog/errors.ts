export class CardNotFoundError extends Error {
  public readonly cardIdentifier: string;

  constructor(cardIdentifier: string) {
    super(`Card not found: ${cardIdentifier}`);
    this.name = 'CardNotFoundError';
    this.cardIdentifier = cardIdentifier;
  }
}
