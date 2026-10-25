import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSendSellList } from '../../api/spare-sell';
import type { IAddLineBody, TCondition } from '../../api/lists';
import type { ISpareRow } from '../../api/spare';
import { DISPLAY_NAME_REQUIRED, EMAIL_NOT_CONFIRMED, isShareErrorCode } from '../../api/shared-decks';
import { useAuth } from '../../auth/useAuth';
import { cardName } from '../../lib/card-name';
import { ligaFabUrl } from '../../lib/ligafab-link';
import { buildWhatsappShareUrl } from '../../lib/whatsapp';
import { ConfirmEmailPanel } from '../confirmation/ConfirmEmailPanel';
import { DisplayNameForm } from '../deck-detail/DisplayNameForm';
import { versionShareUrl } from '../share/shareUrlVersion';
import { useSaveDisplayName } from '../share/useSaveDisplayName';
import { useToast } from '../ui/Toast/useToast';
import {
  draftLines,
  initialPrices,
  lineSubtitle,
  needsFinishAnswer,
  parseReais,
  storedFinish,
  toSellLine,
  type IDraftLine,
} from './sellDraftModel';
import { buildSellMessage, type TFinishAnswer } from './sellMessage';
import styles from './SellDraft.module.css';

interface ISellDraftProps {
  /** The rows of the page, in the order it showed them. */
  readonly rows: readonly ISpareRow[];
  readonly chosen: Readonly<Record<string, number>>;
  readonly onBack: () => void;
  /** Called with the new list's id once its text was sent or copied. */
  readonly onSent: (listId: number) => void;
  /** The day of the list's default name; the clock when absent. */
  readonly today?: Date;
}

const ANSWERS: ReadonlyArray<{ readonly answer: TFinishAnswer; readonly labelKey: string }> = [
  { answer: 'none', labelKey: 'spare.finishNone' },
  { answer: 'foil', labelKey: 'spare.finishFoil' },
  { answer: 'unknown', labelKey: 'spare.finishUnknown' },
];
const NAME_MAX = 80;
const CENTS_PER_REAL = 100;

function dayAndMonth(date: Date): string {
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function openWhatsapp(message: string): void {
  const address = buildWhatsappShareUrl(message);
  const opened = window.open(address, '_blank', 'noopener,noreferrer');
  if (opened === null) window.location.assign(address);
}

/** The sell draft: the list's name, a question per unknown finish, editable prices, the closing line and the message. */
export function SellDraft({ rows, chosen, onBack, onSent, today }: ISellDraftProps): React.ReactElement {
  const { t } = useTranslation();
  const { user, setSellClosingLine } = useAuth();
  const { show } = useToast();
  const send = useSendSellList();
  const displayName = useSaveDisplayName();
  const lines = useMemo(() => draftLines(rows, chosen), [rows, chosen]);
  const [name, setName] = useState(() => t('spare.draftDefaultName', { date: dayAndMonth(today ?? new Date()) }));
  const [prices, setPrices] = useState<Record<string, string>>(() => initialPrices(lines));
  const [answers, setAnswers] = useState<Readonly<Record<string, TFinishAnswer>>>({});
  const [closing, setClosing] = useState(user?.sellClosingLine ?? '');
  const [includeTotal, setIncludeTotal] = useState(true);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [needsName, setNeedsName] = useState(false);

  const questions = lines.filter(needsFinishAnswer);
  const sellLines = lines.map((line) => toSellLine(line, prices[line.key] ?? '', answers[line.key] ?? null));
  const preview = buildSellMessage({ lines: sellLines, includeTotal, closingLine: closing, link: t('spare.linkPlaceholder') }, t);

  function answer(line: IDraftLine, value: TFinishAnswer): void {
    setAnswers((known) => ({ ...known, [line.key]: value }));
  }

  function lineBody(line: IDraftLine): IAddLineBody {
    const reais = parseReais(prices[line.key] ?? '');
    return {
      cardIdentifier: line.row.cardIdentifier,
      quantity: line.quantity,
      printingCode: line.row.printingCode,
      edition: line.row.edition,
      finish: storedFinish(line, answers[line.key] ?? null),
      ...(line.row.condition === '' ? {} : { condition: line.row.condition as TCondition }),
      ...(reais === null ? {} : { priceCents: Math.round(reais * CENTS_PER_REAL) }),
    };
  }

  async function submit(mode: 'whatsapp' | 'copy'): Promise<void> {
    if (busy || name.trim() === '') return;
    setBusy(true);
    setFailed(false);
    let sentListId: number;
    let message: string;
    try {
      const sent = await send({ name: name.trim(), lines: lines.map(lineBody), closingLine: closing.trim() });
      setSellClosingLine?.(closing.trim());
      const unversioned = { lines: sellLines, includeTotal, closingLine: closing, link: '' };
      const link = versionShareUrl(sent.url, `${name}\n${buildSellMessage(unversioned, t)}`);
      message = buildSellMessage({ ...unversioned, link }, t);
      sentListId = sent.listId;
    } catch (error) {
      if (isShareErrorCode(error, DISPLAY_NAME_REQUIRED)) setNeedsName(true);
      else if (isShareErrorCode(error, EMAIL_NOT_CONFIRMED)) setUnconfirmed(true);
      else setFailed(true);
      setBusy(false);
      return;
    }
    if (mode === 'whatsapp') {
      openWhatsapp(message);
    } else {
      try {
        await navigator.clipboard.writeText(message);
        show({ kind: 'success', message: t('spare.copied') });
      } catch {
        show({ kind: 'error', message: t('spare.copyFailed') });
      }
    }
    setBusy(false);
    onSent(sentListId);
  }

  if (unconfirmed) return <ConfirmEmailPanel onClose={() => setUnconfirmed(false)} />;
  if (needsName) {
    return (
      <DisplayNameForm
        initialName={user?.displayName ?? ''}
        saving={displayName.saving}
        error={displayName.error}
        submitLabel={t('sharing.dialog.name.continue')}
        onSubmit={(value) => void displayName.save(value).then((saved) => saved && setNeedsName(false))}
        onCancel={() => setNeedsName(false)}
      />
    );
  }

  return (
    <section className={styles.draft} data-testid="sell-draft">
      <button type="button" className={styles.back} onClick={onBack}>
        {t('spare.backToSpare')}
      </button>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="sell-draft-name">
          {t('spare.draftName')}
        </label>
        <input id="sell-draft-name" className={styles.input} value={name} maxLength={NAME_MAX} onChange={(event) => setName(event.currentTarget.value)} />
      </div>

      {questions.length > 0 && (
        <div className={styles.questions} data-testid="finish-questions">
          <p className={styles.intro}>{t(questions.length === 1 ? 'spare.finishIntro_one' : 'spare.finishIntro_other', { count: questions.length })}</p>
          {questions.map((line) => {
            const label = cardName(line.row.name, line.row.pitch, (key) => t(key));
            return (
              <div key={line.key} className={styles.question} role="group" aria-label={t('spare.finishGroupAria', { name: label })}>
                <p className={styles.questionName}>{label}</p>
                <div className={styles.chips}>
                  {ANSWERS.map((option) => (
                    <button
                      key={option.answer}
                      type="button"
                      className={answers[line.key] === option.answer ? `${styles.chip} ${styles.chipOn}` : styles.chip}
                      aria-pressed={answers[line.key] === option.answer}
                      onClick={() => answer(line, option.answer)}
                    >
                      {t(option.labelKey)}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          <button
            type="button"
            className={styles.link}
            onClick={() => setAnswers((known) => ({ ...known, ...Object.fromEntries(questions.map((line) => [line.key, 'none' as const])) }))}
          >
            {t('spare.finishAllNone')}
          </button>
        </div>
      )}

      <ul className={styles.lines} aria-label={t('spare.rowList')}>
        {lines.map((line) => {
          const label = cardName(line.row.name, line.row.pitch, (key) => t(key));
          return (
            <li key={line.key} className={styles.line} data-testid="draft-line">
              {line.row.imageUrl !== null && <img className={styles.art} src={line.row.imageUrl} alt="" />}
              <div className={styles.lineText}>
                <p className={styles.lineName}>{t('spare.lineHeading', { count: line.quantity, name: label })}</p>
                <p className={styles.lineMeta}>{lineSubtitle(line, answers[line.key] ?? null, t)}</p>
                <div className={styles.priceRow}>
                  <label className={styles.priceBox}>
                    <span className={styles.currency}>R$</span>
                    <input
                      className={styles.priceInput}
                      inputMode="decimal"
                      aria-label={t('spare.priceAria', { name: label })}
                      value={prices[line.key] ?? ''}
                      onChange={(event) => {
                        const value = event.currentTarget.value;
                        setPrices((known) => ({ ...known, [line.key]: value }));
                      }}
                    />
                    {line.quantity > 1 && <span className={styles.each}>{t('spare.priceEach')}</span>}
                  </label>
                  <a className={styles.link} href={ligaFabUrl(line.row.name)} target="_blank" rel="noopener noreferrer">
                    {t('spare.ligaFab')}
                    <span className={styles.srOnly}> {label}</span>
                    <span aria-hidden="true"> ↗</span>
                  </a>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <p className={styles.helper}>{t('spare.priceHelper')}</p>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="sell-draft-closing">
          {t('spare.closingLabel')}
        </label>
        <textarea
          id="sell-draft-closing"
          className={styles.textarea}
          rows={2}
          maxLength={140}
          placeholder={t('spare.closingPlaceholder')}
          value={closing}
          onChange={(event) => setClosing(event.currentTarget.value)}
        />
      </div>

      <div className={styles.switchRow}>
        <span id="sell-draft-total" className={styles.switchLabel}>
          {t('spare.includeTotal')}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={includeTotal}
          aria-labelledby="sell-draft-total"
          className={includeTotal ? `${styles.switch} ${styles.switchOn}` : styles.switch}
          onClick={() => setIncludeTotal((on) => !on)}
        >
          <span className={styles.knob} aria-hidden="true" />
        </button>
      </div>

      <div>
        <p className={styles.messageLabel}>{t('spare.messageLabel')}</p>
        <pre className={styles.message} data-testid="sell-message">
          {preview}
        </pre>
      </div>
      <p className={styles.note}>{t('spare.savedNote', { name: name.trim() })}</p>
      {failed && (
        <p role="alert" className={styles.error}>
          {t('spare.sendFailed')}
        </p>
      )}

      <div className={styles.actions}>
        <button type="button" className={styles.whatsapp} disabled={busy || name.trim() === ''} onClick={() => void submit('whatsapp')}>
          {busy ? t('spare.sending') : t('spare.sendWhatsapp')}
        </button>
        <button type="button" className={styles.copy} disabled={busy || name.trim() === ''} onClick={() => void submit('copy')}>
          {t('spare.copyText')}
        </button>
      </div>
    </section>
  );
}
