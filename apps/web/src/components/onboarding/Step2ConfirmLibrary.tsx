import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button/Button';
import { CardArt } from '../card-art/CardArt';
import { IImportDecksResponse } from '../../api/decks';
import styles from './Step2ConfirmLibrary.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TImportedDeck = IImportDecksResponse['imported'][number];

export interface IStep2ConfirmLibraryProps {
  readonly importedDecks: ReadonlyArray<TImportedDeck>;
  readonly onComplete: () => void;
  readonly onBack: () => void;
  readonly onSkip: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Step 2 of the onboarding wizard — confirm imported library.
 *
 * Renders a preview grid of the just-imported decks using CardArt.
 * Provides Skip (routes to /home) and Continue (advance to step 3) actions.
 */
export function Step2ConfirmLibrary({
  importedDecks,
  onComplete,
  onBack,
  onSkip,
}: IStep2ConfirmLibraryProps): React.ReactElement {
  const { t } = useTranslation();
  return (
    <div className={styles.step}>
      <div className={styles.eyebrow}>{t('onboarding.step2Eyebrow')}</div>
      <h1 className={styles.heading}>{t('onboarding.step2Heading')}</h1>
      <p className={styles.body}>
        {importedDecks.length === 1
          ? t('onboarding.step2BodySingle')
          : t('onboarding.step2BodyMultiple', { count: importedDecks.length })}
      </p>

      {importedDecks.length > 0 && (
        <ul className={styles.deckGrid} aria-label={t('onboarding.importedDecksLabel')}>
          {importedDecks.map((deck) => (
            <li key={deck.trackedDeckId} className={styles.deckItem}>
              <DeckPreviewCard deck={deck} />
            </li>
          ))}
        </ul>
      )}

      <div className={styles.actions}>
        <Button type="button" variant="ghost" onClick={onBack}>
          {t('onboarding.backButton')}
        </Button>
        <div className={styles.actionsRight}>
          <Button type="button" variant="ghost" onClick={onSkip}>
            {t('onboarding.skipForNow')}
          </Button>
          <Button type="button" variant="primary" onClick={onComplete}>
            {t('onboarding.continueButton')}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DeckPreviewCard (internal)
// ---------------------------------------------------------------------------

interface IDeckPreviewCardProps {
  readonly deck: TImportedDeck;
}

function DeckPreviewCard({ deck }: IDeckPreviewCardProps): React.ReactElement {
  const { t } = useTranslation();
  const readiness = deck.readinessSnapshot?.effectivePercent;

  return (
    <div className={styles.previewCard}>
      <CardArt
        name={deck.name}
        pitch={null}
        cost={null}
        type="hero"
        missing={false}
        size="md"
      />
      <div className={styles.previewInfo}>
        <span className={styles.previewName}>{deck.name}</span>
        <span className={styles.previewMeta}>
          {deck.hero} · {deck.format}
        </span>
        {readiness !== undefined && (
          <span className={styles.previewReadiness}>
            {t('onboarding.readinessPercent', { percent: readiness.toFixed(0) })}
          </span>
        )}
      </div>
    </div>
  );
}
