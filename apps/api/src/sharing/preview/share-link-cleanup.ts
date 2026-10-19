// share_link.targetId has no foreign key, so every path that deletes decks must run one of these.
// The stored image holds the deck name, the sharer name and card art; it goes with its link (cascade).

export const DELETE_SHARE_LINKS_FOR_DECK_SQL =
  `DELETE FROM "share_link" WHERE "targetKind" = 'deck' AND "targetId" = $1`;

export const DELETE_SHARE_LINKS_FOR_USERS_SQL =
  `DELETE FROM "share_link" WHERE "ownerUserId" = ANY($1::uuid[])`;
