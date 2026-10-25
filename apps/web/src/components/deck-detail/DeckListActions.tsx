import React from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useDuplicateDeckMutation } from '../../api/decks';
import styles from './DeckListActions.module.css';

interface IDeckListActionsProps {
  readonly deckId: number;
  readonly onCopyList: () => void;
}

/** "Copiar lista" and "Duplicar", each with the line that says what it does. */
export function DeckListActions({ deckId, onCopyList }: IDeckListActionsProps): React.ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const duplicate = useDuplicateDeckMutation(deckId);

  function handleDuplicate(): void {
    duplicate.mutate(undefined, {
      onSuccess: ({ deckId: copyId }) => {
        void navigate({ to: '/decks/$deckId', params: { deckId: String(copyId) }, search: { edit: undefined } });
      },
    });
  }

  return (
    <>
      <div className={styles.action}>
        <button
          type="button"
          className={styles.button}
          aria-describedby="copy-list-hint"
          data-testid="deck-copy-list-btn"
          onClick={onCopyList}
        >
          {t('deckDetail.copyList')}
        </button>
        <span id="copy-list-hint" className={styles.hint}>
          {t('deckDetail.copyListHint')}
        </span>
      </div>
      <div className={styles.action}>
        <button
          type="button"
          className={styles.button}
          aria-describedby="duplicate-deck-hint"
          disabled={duplicate.isPending}
          data-testid="deck-duplicate-btn"
          onClick={handleDuplicate}
        >
          {t('deckDetail.duplicateDeck')}
        </button>
        <span id="duplicate-deck-hint" className={styles.hint}>
          {t('deckDetail.duplicateDeckHint')}
        </span>
        {duplicate.isError && (
          <span className={styles.error} role="alert" data-testid="deck-duplicate-error">
            {t('deckDetail.duplicateFailed')}
          </span>
        )}
      </div>
    </>
  );
}
