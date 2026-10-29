import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useTranslation } from 'react-i18next';
import type { TCopyVariant } from '../../api/shared-decks';
import styles from './SaveDeckChoice.module.css';

interface ISaveDeckChoiceProps {
  readonly sharerName: string;
  /** The cards the sharer's picks took out of the list. */
  readonly originals: readonly string[];
  /** The cards that stand in for them in the deck as built. */
  readonly replacements: readonly string[];
  readonly pending: boolean;
  readonly failed: boolean;
  readonly onSave: (variant: TCopyVariant) => void;
  readonly onClose: () => void;
}

/** "Qual lista você quer salvar?": the sharer's list before the swaps, or the deck as they built it. Nothing is picked at first. */
export function SaveDeckChoice({ sharerName, originals, replacements, pending, failed, onSave, onClose }: ISaveDeckChoiceProps): React.ReactElement {
  const { t } = useTranslation();
  const [picked, setPicked] = useState<TCopyVariant | null>(null);
  const options: readonly { readonly variant: TCopyVariant; readonly label: string }[] = [
    { variant: 'original', label: t('sharing.saveChoice.original', { name: sharerName, cards: originals.join(', ') }) },
    { variant: 'as_built', label: t('sharing.saveChoice.asBuilt', { name: sharerName, cards: replacements.join(', ') }) },
  ];

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.sheet} aria-describedby={undefined}>
          <span className={styles.grip} aria-hidden="true" />
          <Dialog.Title className={styles.heading}>{t('sharing.saveChoice.title')}</Dialog.Title>
          <div className={styles.options} role="radiogroup" aria-label={t('sharing.saveChoice.title')}>
            {options.map((option) => (
              <label key={option.variant} className={picked === option.variant ? `${styles.option} ${styles.optionPicked}` : styles.option}>
                <input
                  type="radio"
                  name="save-variant"
                  className={styles.radio}
                  checked={picked === option.variant}
                  onChange={() => setPicked(option.variant)}
                />
                <span className={styles.optionText}>{option.label}</span>
              </label>
            ))}
          </div>
          <button type="button" className={styles.save} disabled={picked === null || pending} onClick={() => picked !== null && onSave(picked)}>
            {t('sharing.saveChoice.save')}
          </button>
          {failed && <p className={styles.error} role="alert">{t('sharing.saveChoice.failed')}</p>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
