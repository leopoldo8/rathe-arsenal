export const GET_DECK_QUERY = `
query getDeck($deckId: ID!) {
  getDeck(deckId: $deckId) {
    deckId
    name
    format
    heroIdentifier
    hero { cardIdentifier name }
    deckCards {
      cardIdentifier
      quantity
      sideboardQuantity
    }
  }
}
`.trim();
