import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ISharedDeckResponse } from '../../api/shared-decks';
import { CopyListSheet } from '../deck-detail/CopyListSheet';
import { listCardsFromShared } from '../deck-detail/deckListCards';
import styles from './SharedCopyList.module.css';

/** "Copiar lista" on a shared deck: the same two-tab sheet as the owner's, with no account needed. */
export function SharedCopyList({ deck }: { readonly deck: ISharedDeckResponse }): React.ReactElement {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const cards = React.useMemo(() => listCardsFromShared(deck.cards), [deck.cards]);

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.button}
        aria-describedby="shared-copy-list-hint"
        data-testid="shared-copy-list-btn"
        onClick={() => setOpen(true)}
      >
        {t('deckDetail.copyList')}
      </button>
      <span id="shared-copy-list-hint" className={styles.hint}>
        {t('deckDetail.copyListHint')}
      </span>
      <CopyListSheet open={open} onOpenChange={setOpen} deckName={deck.name} format={deck.format} cards={cards} />
    </div>
  );
}
