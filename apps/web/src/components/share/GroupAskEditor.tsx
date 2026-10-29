import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { patchShareClosingLine } from '../../api/shared-decks';
import { useAuth } from '../../auth/useAuth';
import { buildWhatsappShareUrl } from '../../lib/whatsapp';
import { WhatsappGlyph } from '../contact/WhatsappGlyph';
import { buildGroupAskMessage, groupAskCounts, type IGroupAskCard } from './groupAskMessage';
import styles from './GroupAskEditor.module.css';

const CLOSING_LINE_MAX_LENGTH = 140;

interface IGroupAskEditorProps {
  readonly deckName: string;
  readonly hero: string;
  /** The address of the full list, already versioned for WhatsApp's preview cache. */
  readonly url: string;
  readonly cards: readonly IGroupAskCard[];
}

/** The message for the group: what the store cannot supply, the closing line the owner edits, and the address. */
export function GroupAskEditor({ deckName, hero, url, cards }: IGroupAskEditorProps): React.ReactElement {
  const { t } = useTranslation();
  const { user, setShareClosingLine } = useAuth();
  const lastLine = user?.shareClosingLine ?? null;
  const [closingLine, setClosingLine] = useState(lastLine ?? '');
  const [includeStoreSide, setIncludeStoreSide] = useState(false);
  const counts = groupAskCounts(cards);

  const messageOf = (closing: string): string =>
    buildGroupAskMessage({ deckName, hero, url, cards, closingLine: closing, includeStoreSide }, t);
  const head = buildGroupAskMessage({ deckName, hero, url, cards, closingLine: '', includeStoreSide }, t);
  const [beforeClosing, afterClosing] = splitAtAddress(head, t('sharing.groupAsk.fullList', { url }));

  function handleSend(): void {
    const text = closingLine.trim();
    // The line is kept for next time; failing to keep it must not stop the message from going out.
    void patchShareClosingLine(text)
      .then((saved) => setShareClosingLine?.(saved.text))
      .catch(() => undefined);
    window.open(buildWhatsappShareUrl(messageOf(text)), '_blank', 'noopener,noreferrer');
  }

  return (
    <section className={styles.editor} aria-labelledby="group-ask-title">
      <h2 id="group-ask-title" className={styles.title}>
        {t('sharing.groupAsk.title')}
      </h2>
      <p className={styles.hint}>{t('sharing.groupAsk.hint')}</p>

      <div className={styles.message} data-testid="group-ask-message" aria-label={t('sharing.groupAsk.messageAria')}>
        <p className={styles.text}>{beforeClosing}</p>
        <label className={styles.closing}>
          {lastLine !== null && lastLine !== '' && <span className={styles.closingLabel}>{t('sharing.groupAsk.closingLabel')}</span>}
          <textarea
            className={styles.closingField}
            value={closingLine}
            maxLength={CLOSING_LINE_MAX_LENGTH}
            rows={2}
            placeholder={t('sharing.groupAsk.closingPlaceholder')}
            aria-label={t('sharing.groupAsk.closingAria')}
            onChange={(event) => setClosingLine(event.target.value)}
          />
        </label>
        <p className={styles.text}>{afterClosing}</p>
      </div>

      <div className={styles.switchRow}>
        <div className={styles.switchText}>
          <span className={styles.switchTitle}>{t('sharing.groupAsk.includeStore', { count: counts.storeSide })}</span>
          <span className={styles.switchHint}>
            {t(includeStoreSide ? 'sharing.groupAsk.includeStoreOn' : 'sharing.groupAsk.includeStoreOff', {
              count: includeStoreSide ? counts.storeSide : counts.asked,
            })}
          </span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={includeStoreSide}
          aria-label={t('sharing.groupAsk.includeStore', { count: counts.storeSide })}
          className={styles.switch}
          onClick={() => setIncludeStoreSide((on) => !on)}
        />
      </div>

      <button type="button" className={styles.send} onClick={handleSend}>
        <WhatsappGlyph />
        {t('sharing.groupAsk.send')}
      </button>
    </section>
  );
}

/** The message text split where the closing line goes: everything before the address line, and the address line. */
function splitAtAddress(message: string, addressLine: string): readonly [string, string] {
  const index = message.lastIndexOf(addressLine);
  return [message.slice(0, index).trimEnd(), message.slice(index)];
}
