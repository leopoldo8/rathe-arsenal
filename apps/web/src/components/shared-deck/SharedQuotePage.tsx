import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { postShareEvent, type ISharedQuoteItem, type ISharedQuoteResponse } from '../../api/shared-decks';
import { useAuth } from '../../auth/useAuth';
import { cardName } from '../../lib/card-name';
import { buildWhatsappUrl } from '../../lib/whatsapp';
import { WhatsappGlyph } from '../contact/WhatsappGlyph';
import { useToast } from '../ui/Toast/useToast';
import { SharedDeckFooter } from './SharedDeckFooter';
import { SharedTopBar } from './SharedTopBar';
import { readQuoteDraft, writeQuoteDraft, type IQuoteRowDraft, type TQuoteDraft } from './quoteDraft';
import { buildQuoteMessage, buildSpreadsheetList, quoteTotals } from './quoteMessage';
import { formatBrl } from '../../utils/format-brl';
import styles from './SharedQuotePage.module.css';

const NOTE_MAX_LENGTH = 60;
const EMPTY_ROW: IQuoteRowDraft = { have: 0, price: '', note: '' };

interface ISharedQuotePageProps {
  readonly token: string;
  readonly quote: ISharedQuoteResponse;
}

interface IQuoteRowProps {
  readonly item: ISharedQuoteItem;
  readonly row: IQuoteRowDraft;
  readonly onChange: (next: IQuoteRowDraft) => void;
}

function QuoteRow({ item, row, onChange }: IQuoteRowProps): React.ReactElement {
  const { t } = useTranslation();
  const name = cardName(item.name, item.pitch, (key) => t(key));
  const options = Array.from({ length: item.quantity + 1 }, (_, count) => count);

  return (
    <li className={styles.row} data-testid="quote-row">
      <p className={styles.name}>{name}</p>
      <p className={styles.needOf}>{t('sharing.quote.needOf', { count: item.quantity })}</p>
      <div className={styles.field}>
        <span className={styles.fieldLabel} id={`have-${item.cardIdentifier}`}>
          {t('sharing.quote.have')}
        </span>
        <div className={styles.stepper} role="group" aria-labelledby={`have-${item.cardIdentifier}`} aria-label={t('sharing.quote.have')}>
          {options.map((count) => (
            <button
              key={count}
              type="button"
              className={styles.option}
              aria-pressed={row.have === count}
              aria-label={t('sharing.quote.haveOption', { count, name })}
              onClick={() => onChange({ ...row, have: count })}
            >
              {count}
            </button>
          ))}
        </div>
      </div>
      <label className={styles.priceField}>
        <span className={styles.fieldLabel}>{t('sharing.quote.price')}</span>
        <span className={styles.priceInput}>
          <span className={styles.currency} aria-hidden="true">
            {t('sharing.quote.currency')}
          </span>
          <input
            className={styles.price}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={row.price}
            aria-label={t('sharing.quote.priceFor', { name })}
            onChange={(event) => onChange({ ...row, price: event.target.value })}
          />
        </span>
      </label>
      <input
        className={styles.note}
        type="text"
        value={row.note}
        maxLength={NOTE_MAX_LENGTH}
        placeholder={t('sharing.quote.note')}
        aria-label={t('sharing.quote.noteFor', { name })}
        onChange={(event) => onChange({ ...row, note: event.target.value })}
      />
    </li>
  );
}

/**
 * The page behind a `quote` address: the store marks what it has and its price, and answers the sharer on WhatsApp.
 * What the store types stays on this device; the only thing sent to the API is that a quote was sent.
 */
export function SharedQuotePage({ token, quote }: ISharedQuotePageProps): React.ReactElement {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { show } = useToast();
  const [draft, setDraft] = useState<TQuoteDraft>(() => readQuoteDraft(token));

  const totals = quoteTotals(quote.needed, draft);
  const message = buildQuoteMessage({ sharerName: quote.sharerName, deckName: quote.name, needed: quote.needed, draft }, t);

  function changeRow(item: ISharedQuoteItem, next: IQuoteRowDraft): void {
    const updated = { ...draft, [item.cardIdentifier]: next };
    setDraft(updated);
    writeQuoteDraft(token, updated);
  }

  async function copy(text: string, success: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      show({ kind: 'success', message: success });
    } catch {
      show({ kind: 'error', message: t('sharing.quote.copyFailed') });
    }
  }

  async function handleSend(): Promise<void> {
    // Only the fact that a quote went out is counted, never what it says; a failed post never stops the answer.
    void postShareEvent(token, 'quote_sent').catch(() => undefined);
    if (quote.contactWhatsapp !== null) {
      window.open(buildWhatsappUrl(quote.contactWhatsapp, message), '_blank', 'noopener,noreferrer');
      return;
    }
    await copy(message, t('sharing.quote.copied', { name: quote.sharerName }));
  }

  return (
    <div className={styles.page}>
      <SharedTopBar shareToken={token} isSignedIn={user !== null} offerSignUp={false} />
      <main className={styles.main}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>{t('sharing.quote.eyebrow')}</p>
          <h1 className={styles.title}>{t('sharing.quote.title', { name: quote.sharerName })}</h1>
          <p className={styles.lead}>{t('sharing.quote.lead')}</p>
          <p className={styles.needs}>
            {t('sharing.quote.needs', {
              name: quote.sharerName,
              copies: t('sharing.quote.copies', { count: totals.needed }),
              cards: t('sharing.quote.cards', { count: quote.needed.length }),
            })}
          </p>
        </header>

        {quote.needed.length === 0 ? (
          <p className={styles.lead}>{t('sharing.quote.empty')}</p>
        ) : (
          <>
            <ul className={styles.list}>
              {quote.needed.map((item) => (
                <QuoteRow key={item.cardIdentifier} item={item} row={draft[item.cardIdentifier] ?? EMPTY_ROW} onChange={(next) => changeRow(item, next)} />
              ))}
            </ul>

            <section className={styles.previewSection}>
              <h2 className={styles.previewTitle}>{t('sharing.quote.previewTitle')}</h2>
              <p className={styles.preview} data-testid="quote-preview">
                {totals.have === 0 ? t('sharing.quote.previewEmpty') : message}
              </p>
            </section>

            <button
              type="button"
              className={styles.spreadsheet}
              onClick={() => void copy(buildSpreadsheetList(quote.needed, t), t('sharing.quote.spreadsheetCopied'))}
            >
              {t('sharing.quote.spreadsheet')}
            </button>
          </>
        )}
      </main>
      <SharedDeckFooter glossaryBackLabel={t('glossary.page.backToSharedList', { name: quote.sharerName })} />
      <div className={styles.bar} data-testid="quote-bar">
        <p className={styles.barTotal}>
          {t('sharing.quote.footerTotal', { have: totals.have, count: totals.needed, price: formatBrl(totals.cents) })}
        </p>
        <button type="button" className={styles.send} disabled={totals.have === 0} onClick={() => void handleSend()}>
          <WhatsappGlyph />
          {t('sharing.quote.send')}
        </button>
      </div>
    </div>
  );
}
