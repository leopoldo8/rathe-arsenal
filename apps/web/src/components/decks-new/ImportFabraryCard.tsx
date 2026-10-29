/**
 * ImportFabraryCard: card for importing a deck from a Fabrary link.
 *
 * The link is read from whatever the player pastes; once it points at a deck the card shows it and
 * asks whose cards they are, and the deck opens when it is imported.
 */
import React, { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { findFabraryDeckId } from '../../lib/fabrary-link';
import { FabraryFound } from '../fabrary-import/FabraryFound';
import styles from './ImportFabraryCard.module.css';

export function ImportFabraryCard(): React.ReactElement {
  const { t } = useTranslation();
  const inputId = useId();
  const helpId = useId();
  const [url, setUrl] = useState('');

  const hasLink = findFabraryDeckId(url) !== null;
  const notALink = url.trim() !== '' && !hasLink;

  return (
    <div className={styles.card} data-testid="import-fabrary-card">
      <div className={styles.head}>
        <div className={styles.headText}>
          <h2 className={styles.cardTitle}>{t('decks.importFromFabrary')}</h2>
          <p className={styles.cardSubtitle}>{t('decks.importFabrarySubtitle')}</p>
        </div>
      </div>

      <div className={styles.form}>
        <label className={styles.label} htmlFor={inputId}>
          {t('decks.fabraryDeckUrlLabel')}
        </label>
        <input
          id={inputId}
          type="text"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="https://fabrary.net/decks/…"
          value={url}
          onChange={(event) => setUrl(event.currentTarget.value)}
          className={styles.input}
          aria-describedby={helpId}
          aria-invalid={notALink}
        />
        <p id={helpId} className={styles.helpText}>
          {t('decks.fabraryUrlHelp')}
        </p>
      </div>

      {notALink && (
        <section className={styles.errorCallout} role="alert">
          <p className={styles.errorBody}>{t('decks.invalidFabraryUrlLocal')}</p>
        </section>
      )}

      {hasLink && <FabraryFound text={url} openDeckAfterImport />}
    </div>
  );
}
