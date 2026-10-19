import React from 'react';
import { useTranslation } from 'react-i18next';
import { WhatsappGlyph } from './WhatsappGlyph';
import styles from './WhatsappPreview.module.css';

interface IWhatsappPreviewProps {
  /** Name the button speaks of (the sharer's display name). */
  readonly name: string;
  /** Ready message to show under the button; omitted in Settings, where no deck is involved. */
  readonly message?: string;
}

/** Static sample of the green button as it appears on the shared page. Not interactive. */
export function WhatsappPreview({ name, message }: IWhatsappPreviewProps): React.ReactElement {
  const { t } = useTranslation();
  return (
    <div className={styles.preview} data-testid="whatsapp-preview">
      <p className={styles.label}>{t('sharing.contact.previewLabel')}</p>
      <span className={styles.button}>
        <WhatsappGlyph />
        {t('sharing.contact.chatButton', { name })}
      </span>
      {message !== undefined && (
        <p className={styles.message}>{t('sharing.contact.previewMessage', { message })}</p>
      )}
    </div>
  );
}
