import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { buildWhatsappUrl } from '../../lib/whatsapp';
import { WhatsappGlyph } from '../contact/WhatsappGlyph';
import styles from './ShareMessageView.module.css';

interface IShareMessageViewProps {
  readonly backLabel: string;
  readonly initialText: string;
  /** Digits with country code; null when the link shows no number. */
  readonly whatsapp: string | null;
  readonly onBack: () => void;
  /** Called when the visitor sends the text or copies it, so the sharer's counts can record it. */
  readonly onSent?: () => void;
}

/**
 * "Mensagem para o WhatsApp": the text the visitor is about to send, editable. With the sharer's number the button opens
 * their chat; with none it copies the text and says where to paste it.
 */
export function ShareMessageView({ backLabel, initialText, whatsapp, onBack, onSent }: IShareMessageViewProps): React.ReactElement {
  const { t } = useTranslation();
  const [text, setText] = useState(initialText);
  const [status, setStatus] = useState<string | null>(null);

  async function copy(copiedKey: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      setStatus(t(copiedKey));
    } catch {
      setStatus(t('sharing.shareMessage.copyFailed'));
    }
  }

  function send(): void {
    onSent?.();
    if (whatsapp !== null) {
      window.open(buildWhatsappUrl(whatsapp, text), '_blank', 'noopener,noreferrer');
      return;
    }
    void copy('sharing.shareMessage.copiedForGroup');
  }

  return (
    <section className={styles.view} data-testid="share-message-view">
      <button type="button" className={styles.back} onClick={onBack}>
        {backLabel}
      </button>
      <h1 className={styles.heading}>{t('sharing.shareMessage.title')}</h1>
      <p className={styles.hint}>{t('sharing.shareMessage.hint')}</p>
      <textarea
        className={styles.text}
        aria-label={t('sharing.shareMessage.label')}
        value={text}
        rows={8}
        onChange={(event) => {
          setText(event.currentTarget.value);
          setStatus(null);
        }}
      />
      <p className={styles.status} role="status">
        {status ?? ''}
      </p>
      <div className={styles.actions}>
        <button type="button" className={styles.send} onClick={send}>
          <WhatsappGlyph />
          {t('sharing.shareMessage.send')}
        </button>
        <button type="button" className={styles.copy} onClick={() => {
            onSent?.();
            void copy('sharing.shareMessage.copied');
          }}>
          {t('sharing.shareMessage.copy')}
        </button>
      </div>
    </section>
  );
}
