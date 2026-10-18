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

export const GET_COMMUNITY_DECK_QUERY = `
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
    matchups { matchupId }
  }
}
`.trim();
