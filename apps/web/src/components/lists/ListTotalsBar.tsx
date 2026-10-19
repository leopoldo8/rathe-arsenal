import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ICardList } from '../../api/lists';
import { Button } from '../ui/Button/Button';
import { buildListText, formatMoneyInput, listTotals, makeTranslate, parseMoney } from './listsModel';
import styles from './ListEditor.module.css';

const COPIED_FEEDBACK_MS = 2000;

interface IListTotalsBarProps {
  readonly list: ICardList;
  /** The list's live address; the copied text ends with it. Null while sharing is off. */
  readonly shareUrl: string | null;
  readonly onSaveTotal: (cents: number | null) => void;
  readonly onShare: () => void;
}

function ShareIcon(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" />
      <line x1="15.4" y1="6.5" x2="8.6" y2="10.5" />
    </svg>
  );
}

function CopyIcon({ done }: { readonly done: boolean }): React.ReactElement {
  if (done) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function ListTotalsBar({ list, shareUrl, onSaveTotal, onShare }: IListTotalsBarProps): React.ReactElement {
  const { t } = useTranslation();
  const totals = listTotals(list.lines);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [totalDraft, setTotalDraft] = useState<string | null>(null);
  const [totalInvalid, setTotalInvalid] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  async function copyText(): Promise<void> {
    try {
      await navigator.clipboard.writeText(buildListText(list, makeTranslate(t), shareUrl));
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopyState('idle'), COPIED_FEEDBACK_MS);
  }

  function commitTotal(): void {
    if (totalDraft === null) return;
    const parsed = parseMoney(totalDraft);
    if (!parsed.valid) {
      setTotalInvalid(true);
      return;
    }
    setTotalInvalid(false);
    setTotalDraft(null);
    if (parsed.cents !== list.totalPriceCents) onSaveTotal(parsed.cents);
  }

  const secondary =
    list.kind === 'want'
      ? t('lists.bar.wantCaption')
      : totals.sold > 0
        ? t('lists.bar.sold', { count: totals.sold })
        : '';

  return (
    <div className={styles.bar} data-testid="totals-bar">
      <div className={styles.barTotals}>
        <div className={styles.barBig}>{t('lists.bar.cards', { count: totals.cards })}</div>
        {secondary !== '' && <div className={styles.barSmall}>{secondary}</div>}
      </div>
      {list.kind === 'sell' && (
        <label className={styles.barTotal}>
          <span className={styles.barSmall}>{t('lists.bar.totalLabel')}</span>
          <input
            className={styles.totalInput}
            type="text"
            inputMode="decimal"
            aria-invalid={totalInvalid || undefined}
            placeholder={t('lists.bar.totalPlaceholder')}
            value={totalDraft ?? (list.totalPriceCents === null ? '' : `R$ ${formatMoneyInput(list.totalPriceCents)}`)}
            onFocus={() => setTotalDraft(formatMoneyInput(list.totalPriceCents))}
            onChange={(event) => {
              setTotalInvalid(false);
              setTotalDraft(event.currentTarget.value);
            }}
            onBlur={commitTotal}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
              if (event.key === 'Escape') {
                setTotalDraft(null);
                setTotalInvalid(false);
              }
            }}
          />
        </label>
      )}
      <div className={styles.barActions}>
        <Button
          variant="secondary"
          className={styles.copyBtn}
          aria-label={t('lists.bar.share')}
          leftIcon={<ShareIcon />}
          onClick={onShare}
          data-testid="list-share-open"
        >
          <span className={styles.copyLabel}>{t('lists.bar.share')}</span>
        </Button>
        <Button
          variant="secondary"
          className={styles.copyBtn}
          aria-label={t('lists.bar.copyText')}
          leftIcon={<CopyIcon done={copyState === 'copied'} />}
          disabled={totals.available === 0}
          onClick={() => void copyText()}
        >
          <span className={styles.copyLabel}>{copyState === 'copied' ? t('lists.bar.copied') : t('lists.bar.copyText')}</span>
        </Button>
      </div>
      <p className={styles.barStatus} role="status">{copyState === 'failed' ? t('lists.bar.copyFailed') : ''}</p>
    </div>
  );
}
