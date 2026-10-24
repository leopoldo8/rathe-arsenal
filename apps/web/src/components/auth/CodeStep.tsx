import React, { ClipboardEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthFetchError } from '../../lib/auth-fetch';
import { useAuth } from '../../auth/useAuth';
import { localizeAuthError } from '../../auth/localize-auth-error';
import { requestSignInCode } from '../../lib/account-api';
import { rememberSignIn } from '../../lib/remembered-account';
import styles from './AccountSteps.module.css';

const DIGITS = 6;
const DEFAULT_RESEND_SECONDS = 45;
const GMAIL_DOMAINS: readonly string[] = ['gmail.com', 'googlemail.com'];

type TProblem = 'wrong' | 'expired' | null;

interface ICodeStepProps {
  readonly email: string;
  readonly onChangeEmail: () => void;
  readonly onSignedIn: (returnPath: string | null) => void;
}

function isGmail(email: string): boolean {
  return GMAIL_DOMAINS.includes(email.split('@')[1]?.toLowerCase() ?? '');
}

function secondsUntil(isoTime: string): number {
  const wait = Math.ceil((Date.parse(isoTime) - Date.now()) / 1000);
  return Number.isFinite(wait) && wait > 0 ? wait : 0;
}

export function CodeStep({ email, onChangeEmail, onSignedIn }: ICodeStepProps): React.ReactElement {
  const { t } = useTranslation();
  const { verifyCode } = useAuth();
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const requested = useRef(false);
  const [digits, setDigits] = useState<readonly string[]>(() => Array<string>(DIGITS).fill(''));
  const [problem, setProblem] = useState<TProblem>(null);
  const [error, setError] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_RESEND_SECONDS);
  const [busy, setBusy] = useState(false);

  const sendCode = useCallback(async (): Promise<void> => {
    setError('');
    try {
      const sent = await requestSignInCode(email);
      setSecondsLeft(secondsUntil(sent.resendAfter));
    } catch (err) {
      setError(localizeAuthError(err, t));
    }
  }, [email, t]);

  useEffect(() => {
    // Strict mode runs effects twice; a second request would replace the first code before it is read.
    if (requested.current) return;
    requested.current = true;
    void sendCode();
  }, [sendCode]);

  useEffect(() => {
    if (secondsLeft <= 0) return undefined;
    const timer = setTimeout(() => setSecondsLeft((current) => current - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  function clearBoxes(): void {
    setDigits(Array<string>(DIGITS).fill(''));
    boxes.current[0]?.focus();
  }

  async function submit(code: string): Promise<void> {
    setBusy(true);
    setError('');
    try {
      const { returnPath } = await verifyCode(email, code);
      rememberSignIn(email, 'code');
      onSignedIn(returnPath);
    } catch (err) {
      if (err instanceof AuthFetchError && err.status === 410) setProblem('expired');
      else if (err instanceof AuthFetchError && err.status === 401) setProblem('wrong');
      else setError(localizeAuthError(err, t));
      clearBoxes();
      setBusy(false);
    }
  }

  function setDigitsFrom(start: number, typed: string): void {
    if (busy) return;
    const onlyDigits = typed.replace(/\D/g, '');
    if (onlyDigits === '') return;
    const next = [...digits];
    for (let i = 0; i < onlyDigits.length && start + i < DIGITS; i++) next[start + i] = onlyDigits[i] ?? '';
    setDigits(next);
    setProblem(null);
    const focusAt = Math.min(start + onlyDigits.length, DIGITS - 1);
    boxes.current[focusAt]?.focus();
    const code = next.join('');
    if (code.length === DIGITS && !next.includes('')) void submit(code);
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key !== 'Backspace' || digits[index] !== '') return;
    boxes.current[Math.max(index - 1, 0)]?.focus();
  }

  function handlePaste(index: number, event: ClipboardEvent<HTMLInputElement>): void {
    event.preventDefault();
    setDigitsFrom(index, event.clipboardData.getData('text'));
  }

  function handleResend(): void {
    setProblem(null);
    clearBoxes();
    setSecondsLeft(DEFAULT_RESEND_SECONDS);
    void sendCode();
  }

  const expired = problem === 'expired';
  return (
    <div className={styles.form}>
      <p className={styles.lead}>
        {t('account.codeSentTo', { email })}
        {!expired && ` ${t('account.codeValid')}`}
      </p>
      {problem !== null && (
        <p className={styles.fieldError} role="alert">
          {expired ? t('account.codeExpired') : t('account.codeWrong')}
        </p>
      )}
      {error !== '' && (
        <p className={styles.fieldError} role="alert">
          {error}
        </p>
      )}

      <div className={styles.codeRow}>
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(node) => {
              boxes.current[index] = node;
            }}
            className={styles.codeBox}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={DIGITS}
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            aria-label={t('account.codeDigit', { position: index + 1 })}
            aria-invalid={problem !== null ? 'true' : undefined}
            value={digit}
            readOnly={busy}
            onChange={(e) => setDigitsFrom(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={(e) => handlePaste(index, e)}
          />
        ))}
      </div>

      {!expired && <p className={styles.note}>{t('account.codeButtonHint')}</p>}

      {expired ? (
        <button type="button" className={styles.primaryBtn} onClick={handleResend}>
          {t('account.sendNewCode')}
        </button>
      ) : (
        <button
          type="button"
          className={styles.secondaryBtn}
          aria-disabled={secondsLeft > 0 ? 'true' : undefined}
          onClick={secondsLeft > 0 ? undefined : handleResend}
        >
          {secondsLeft > 0 ? t('account.resendIn', { seconds: secondsLeft }) : t('account.resendNow')}
        </button>
      )}
      <button type="button" className={styles.secondaryBtn} onClick={onChangeEmail}>
        {t('account.otherEmail')}
      </button>
      <p className={styles.note}>{t(isGmail(email) ? 'account.spamPromotions' : 'account.spam')}</p>
    </div>
  );
}
