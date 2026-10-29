import React, { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useCreateScratchDeckMutation } from '../../api/decks';
import type { IHeroListItem } from '../../api/catalog';
import { ApiError } from '../../lib/api-client';
import { FORMAT_LINE_KEY, supportedFormatsOf } from './newDeckFormats';
import styles from './NewDeckFormatStep.module.css';

interface INewDeckFormatStepProps {
  readonly hero: IHeroListItem;
  readonly onBack: () => void;
}

export function NewDeckFormatStep({ hero, onBack }: INewDeckFormatStepProps): React.ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createMutation = useCreateScratchDeckMutation();
  const [format, setFormat] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function start(): void {
    if (format === null) return;
    setErrorMessage(null);
    createMutation.mutate(
      { heroIdentifier: hero.cardIdentifier, format },
      {
        onSuccess: (result) => {
          void navigate({
            to: '/decks/$deckId',
            params: { deckId: String(result.id) },
            search: { edit: 1 },
            state: (previous) => ({ ...previous, justCreated: true }),
          });
        },
        onError: (error) => {
          setErrorMessage(error instanceof ApiError ? error.message : error.message || t('decks.failedToCreateDeck'));
        },
      },
    );
  }

  return (
    <div className={styles.step} data-testid="new-deck-format-step">
      <button type="button" className={styles.back} onClick={onBack}>
        {t('decks.chooseAnotherHero')}
      </button>
      <h1 className={styles.title}>{t('decks.addNewDeck')}</h1>
      <div className={styles.hero}>
        {hero.imageUrl !== null && <img className={styles.art} src={hero.imageUrl.small} alt="" />}
        <div className={styles.heroText}>
          <p className={styles.heroName}>{t('decks.heroChosen', { name: hero.name })}</p>
          {hero.young && <p className={styles.heroKind}>{t('decks.heroYoungBadge')}</p>}
        </div>
      </div>
      <fieldset className={styles.formats}>
        <legend className={styles.legend}>{t('decks.formatLabel')}</legend>
        {supportedFormatsOf(hero.legalFormats).map((option) => (
          <label key={option} className={styles.format}>
            <input
              type="radio"
              name="new-deck-format"
              value={option}
              checked={format === option}
              onChange={() => setFormat(option)}
              className={styles.radio}
            />
            <span className={styles.formatName}>{option}</span>
            <span className={styles.formatLine}>{t(FORMAT_LINE_KEY[option] ?? '')}</span>
          </label>
        ))}
      </fieldset>
      {errorMessage !== null && (
        <section className={styles.error} role="alert" data-testid="scratch-error">
          <p className={styles.errorTitle}>{t('decks.failedToCreateDeck')}</p>
          <p className={styles.errorBody}>{errorMessage}</p>
        </section>
      )}
      <div className={styles.footer}>
        <button
          type="button"
          className={styles.start}
          onClick={start}
          disabled={format === null || createMutation.isPending}
          data-testid="start-building-btn"
        >
          {createMutation.isPending ? t('decks.creating') : t('decks.startBuilding')}
        </button>
      </div>
    </div>
  );
}
