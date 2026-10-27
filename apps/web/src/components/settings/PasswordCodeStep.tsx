import React, { ClipboardEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ICodeRequest } from '../../lib/account-api';
import styles from './AccountSetting.module.css';

const DIGITS = 6;
const MS_PER_MINUTE = 60 * 1000;

export type TCodeProblem = 'wrong' | 'expired';

interface IPasswordCodeStepProps {
  readonly email: string;
  /** What the server said about the code that was just e-mailed. */
  readonly sent: ICodeRequest;
  readonly problem: TCodeProblem | null;
  readonly error: string;
  readonly resending: boolean;
  /** Called once all six digits are typed. The code is checked when the password is saved. */
  readonly onFilled: (code: string) => void;
  readonly onResend: () => void;
  readonly onCancel: () => void;
}

function secondsUntil(isoTime: string): number {
  const wait = Math.ceil((Date.parse(isoTime) - Date.now()) / 1000);
  return Number.isFinite(wait) && wait > 0 ? wait : 0;
}

function minutesUntil(isoTime: string): number {
  const minutes = Math.round((Date.parse(isoTime) - Date.now()) / MS_PER_MINUTE);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 1;
}

/** First step of a password change (`r6-password-b-phone`): the six digits e-mailed to the account's own address. */
export function PasswordCodeStep({ email, sent, problem, error, resending, onFilled, onResend, onCancel }: IPasswordCodeStepProps): React.ReactElement {
  const { t } = useTranslation();
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const [digits, setDigits] = useState<readonly string[]>(() => Array<string>(DIGITS).fill(''));
  const [secondsLeft, setSecondsLeft] = useState(() => secondsUntil(sent.resendAfter));
  const expired = problem === 'expired';

  useEffect(() => {
    boxes.current[0]?.focus();
  }, []);

  useEffect(() => {
    setSecondsLeft(secondsUntil(sent.resendAfter));
    setDigits(Array<string>(DIGITS).fill(''));
  }, [sent]);

  useEffect(() => {
    if (secondsLeft <= 0) return undefined;
    const timer = setTimeout(() => setSecondsLeft((current) => current - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  function setDigitsFrom(start: number, typed: string): void {
    const onlyDigits = typed.replace(/\D/g, '');
    if (onlyDigits === '') return;
    const next = [...digits];
    for (let i = 0; i < onlyDigits.length && start + i < DIGITS; i++) next[start + i] = onlyDigits[i] ?? '';
    setDigits(next);
    boxes.current[Math.min(start + onlyDigits.length, DIGITS - 1)]?.focus();
    if (!next.includes('')) onFilled(next.join(''));
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key !== 'Backspace' || digits[index] !== '') return;
    boxes.current[Math.max(index - 1, 0)]?.focus();
  }

  function handlePaste(index: number, event: ClipboardEvent<HTMLInputElement>): void {
    event.preventDefault();
    setDigitsFrom(index, event.clipboardData.getData('text'));
  }

  const waiting = secondsLeft > 0 && !expired;
  return (
    <div className={styles.codeStep}>
      {problem !== null && (
        <p className={styles.error} role="alert">
          {expired ? t('account.codeExpired') : t('account.codeWrong')}
        </p>
      )}
      {error !== '' && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <p className={styles.lead}>
        {t('settings.passwordCodeSentBefore')}
        <b>{email}</b>
        {t('settings.passwordCodeSentAfter', { count: minutesUntil(sent.expiresAt) })}
      </p>
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
            aria-invalid={problem === 'wrong' ? 'true' : undefined}
            value={digit}
            onChange={(event) => setDigitsFrom(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={(event) => handlePaste(index, event)}
          />
        ))}
      </div>
      <button
        type="button"
        className={styles.resend}
        aria-disabled={waiting || resending ? 'true' : undefined}
        onClick={waiting || resending ? undefined : onResend}
      >
        {expired ? t('account.sendNewCode') : waiting ? t('account.resendIn', { seconds: secondsLeft }) : t('account.resendNow')}
      </button>
      <button type="button" className={styles.cancelText} onClick={onCancel}>
        {t('settings.passwordCancel')}
      </button>
    </div>
  );
}
