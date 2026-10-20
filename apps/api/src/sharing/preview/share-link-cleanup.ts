// share_link.targetId has no foreign key, so every path that deletes decks or lists must run one of these.
// The stored image holds the deck or list name, the sharer name and card art; it goes with its link (cascade).

export const DELETE_SHARE_LINKS_FOR_DECK_SQL =
  `DELETE FROM "share_link" WHERE "targetKind" = 'deck' AND "targetId" = $1`;

export const DELETE_SHARE_LINKS_FOR_LIST_SQL =
  `DELETE FROM "share_link" WHERE "targetKind" = 'list' AND "targetId" = $1`;

export const DELETE_SHARE_LINKS_FOR_USERS_SQL =
  `DELETE FROM "share_link" WHERE "ownerUserId" = ANY($1::uuid[])`;
