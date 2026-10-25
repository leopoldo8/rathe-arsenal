import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { findFabraryDeckId } from '../../lib/fabrary-link';
import { setPastedList } from '../../lib/pasted-list';
import { FabraryFound } from '../fabrary-import/FabraryFound';
import styles from './AddCardsEntry.module.css';

/**
 * The paste box of "Adicionar cartas": a pasted Fabrary link shows the deck and asks whose cards they
 * are; any other pasted text is a list of cards and opens the list reader with it.
 */
export function AddCardsEntry(): React.ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const pasted = useRef(false);
  const hasLink = findFabraryDeckId(text) !== null;

  function change(event: React.ChangeEvent<HTMLTextAreaElement>): void {
    const next = event.target.value;
    setText(next);
    if (!pasted.current) return;
    pasted.current = false;
    if (next.trim() === '' || findFabraryDeckId(next) !== null) return;
    setPastedList(next);
    void navigate({ to: '/add-cards/list' });
  }

  return (
    <div className={styles.entry}>
      <textarea
        className={styles.paste}
        value={text}
        placeholder={t('decks.addCardsPastePlaceholder')}
        aria-label={t('decks.addCardsPasteLabel')}
        aria-describedby="add-cards-paste-hint"
        data-active={hasLink}
        onPaste={() => {
          pasted.current = true;
        }}
        onChange={change}
      />
      {hasLink ? (
        <FabraryFound text={text} />
      ) : (
        <p id="add-cards-paste-hint" className={styles.hint}>
          {t('decks.addCardsPasteHint')}
        </p>
      )}
    </div>
  );
}
