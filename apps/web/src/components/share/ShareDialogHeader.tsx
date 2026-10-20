import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useTranslation } from 'react-i18next';
import styles from './ShareSteps.module.css';

interface IShareDialogHeaderProps {
  readonly title: string;
  /** Shows a back arrow when set. */
  readonly onBack?: (() => void) | undefined;
}

export function ShareDialogHeader({ title, onBack }: IShareDialogHeaderProps): React.ReactElement {
  const { t } = useTranslation();
  return (
    <div className={styles.header}>
      {onBack !== undefined && (
        <button
          type="button"
          className={styles.iconBtn}
          aria-label={t('sharing.dialog.back')}
          onClick={onBack}
          data-testid="share-back"
        >
          <span aria-hidden="true" className={styles.backGlyph}>&#8249;</span>
        </button>
      )}
      <Dialog.Title className={styles.title}>{title}</Dialog.Title>
      <Dialog.Close className={styles.iconBtn} aria-label={t('sharing.dialog.close')}>
        <span aria-hidden="true">&#10005;</span>
      </Dialog.Close>
    </div>
  );
}
