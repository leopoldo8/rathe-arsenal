import React from 'react';
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
  return (
    <div className={styles.step}>
      <div className={styles.eyebrow}>Step 2 of 3</div>
      <h1 className={styles.heading}>Your library</h1>
      <p className={styles.body}>
        {importedDecks.length === 1
          ? 'We found your deck. Confirm it looks right before we compute substitutions.'
          : `We found ${importedDecks.length} decks. Confirm they look right before we compute substitutions.`}
      </p>

      {importedDecks.length > 0 && (
        <ul className={styles.deckGrid} aria-label="Imported decks">
          {importedDecks.map((deck) => (
            <li key={deck.trackedDeckId} className={styles.deckItem}>
              <DeckPreviewCard deck={deck} />
            </li>
          ))}
        </ul>
      )}

      <div className={styles.actions}>
        <Button type="button" variant="ghost" onClick={onBack}>
          Back
        </Button>
        <div className={styles.actionsRight}>
          <Button type="button" variant="ghost" onClick={onSkip}>
            Skip for now
          </Button>
          <Button type="button" variant="primary" onClick={onComplete}>
            Continue
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
            {readiness.toFixed(0)}% ready
          </span>
        )}
      </div>
    </div>
  );
}
