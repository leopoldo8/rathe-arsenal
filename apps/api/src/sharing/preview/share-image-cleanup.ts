// share_image.targetId has no foreign key, so every path that deletes decks must run one of these.
// The stored image holds the deck name, the sharer name and card art.

export const DELETE_SHARE_IMAGE_FOR_DECK_SQL =
  `DELETE FROM "share_image" WHERE "targetKind" = 'deck' AND "targetId" = $1`;

/** Run before the users' tracked_deck rows are deleted, while the subquery can still find them. */
export const DELETE_SHARE_IMAGES_FOR_USERS_SQL = `DELETE FROM "share_image"
  WHERE "targetKind" = 'deck' AND "targetId" IN (
    SELECT id FROM "tracked_deck" WHERE "userId" = ANY($1::uuid[])
  )`;
