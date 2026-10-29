import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSetOwnedMutation, type IMissingLine } from '../../api/missing-list';
import { cardName } from '../../lib/card-name';
import { useToast } from '../ui/Toast/useToast';
import styles from './OwnedStepper.module.css';

interface IOwnedStepperProps {
  readonly deckId: number;
  readonly line: IMissingLine;
  /** Called after a number was saved, so a row that opened the stepper can close it. */
  readonly onPicked?: () => void;
  /** The table cell keeps the stepper always open, with no question above it. */
  readonly showTitle?: boolean;
}

/** "Quantas você já tem?": options 0 to the deck's copies, never below what other imports already hold. */
export function OwnedStepper({ deckId, line, onPicked, showTitle = true }: IOwnedStepperProps): React.ReactElement {
  const { t } = useTranslation();
  const { show } = useToast();
  const setOwned = useSetOwnedMutation(deckId);
  const name = cardName(line.name, line.pitch, t);
  const selected = Math.min(line.ownedTotal, line.deckQuantity);
  const options = Array.from({ length: line.deckQuantity + 1 }, (_, index) => index);

  function pick(ownedTotal: number): void {
    if (ownedTotal === selected || setOwned.isPending) return;
    setOwned.mutate(
      { cardIdentifier: line.cardIdentifier, ownedTotal },
      {
        onSuccess: ({ previousManualQuantity }) => {
          onPicked?.();
          show({
            kind: 'success',
            message: t('missingList.stepperToast', { name, count: ownedTotal }),
            action: {
              label: t('missingList.undo'),
              onClick: () =>
                setOwned.mutate(
                  { cardIdentifier: line.cardIdentifier, ownedTotal: line.ownedElsewhere + previousManualQuantity },
                  { onError: () => show({ kind: 'error', message: t('missingList.stepperUndoFailed') }) },
                ),
            },
          });
        },
        onError: () => show({ kind: 'error', message: t('missingList.stepperFailed') }),
      },
    );
  }

  return (
    <div className={styles.stepper} data-testid="owned-stepper">
      {showTitle && <p className={styles.title}>{t('missingList.stepperTitle')}</p>}
      <div role="group" aria-label={t('missingList.stepperAria', { name })} className={styles.options}>
        {options.map((count) => {
          const below = count < line.ownedElsewhere;
          return (
            <button
              key={count}
              type="button"
              className={count === selected ? `${styles.option} ${styles.selected}` : styles.option}
              aria-pressed={count === selected}
              aria-disabled={below || undefined}
              disabled={below}
              onClick={() => pick(count)}
            >
              {count}
            </button>
          );
        })}
      </div>
      {line.ownedElsewhere > 0 && <p className={styles.library}>{t('missingList.stepperLibrary', { count: line.ownedElsewhere })}</p>}
    </div>
  );
}
