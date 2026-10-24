import React, { FormEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useRouter } from '@tanstack/react-router';
import { useAuth } from '../../auth/useAuth';
import { localizeAuthError } from '../../auth/localize-auth-error';
import { clearShareReturn, type IShareReturn } from '../../lib/share-return';
import { rememberSignIn } from '../../lib/remembered-account';
import { useToast } from '../ui/Toast/useToast';
import { ofOwner } from './owner-phrase';
import type { IShareOrigin } from './ShareOrigin';
import { useIsPhone } from './useIsPhone';
import styles from './AccountSteps.module.css';

/** Where a new account starts today; journey 2 swaps this for its first-run chooser. */
export const FIRST_STEPS_PATH = '/onboarding';

const MIN_PASSWORD_LENGTH = 10;

interface INewAccountStepProps {
  readonly email: string;
  /** The shared page the visitor came from, when there is one: the account goes back to it. */
  readonly shareReturn: IShareReturn | null;
  readonly origin: IShareOrigin | null;
  readonly onWrongEmail: () => void;
}

export function NewAccountStep({ email, shareReturn, origin, onWrongEmail }: INewAccountStepProps): React.ReactElement {
  const { t } = useTranslation();
  const { signUp } = useAuth();
  const { show } = useToast();
  const navigate = useNavigate();
  const router = useRouter();
  const isPhone = useIsPhone();
  const passwordRef = useRef<HTMLInputElement>(null);
  const [withPassword, setWithPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (withPassword) passwordRef.current?.focus();
  }, [withPassword]);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (submitting) return;
    setServerError('');
    if (withPassword && password.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(true);
      passwordRef.current?.focus();
      return;
    }
    setPasswordError(false);
    setSubmitting(true);
    try {
      await signUp({
        email,
        ...(withPassword ? { password } : {}),
        ...(shareReturn !== null ? { shareToken: shareReturn.shareToken, returnPath: shareReturn.returnTo } : {}),
      });
      rememberSignIn(email, withPassword ? 'password' : 'code');
      finish();
    } catch (err) {
      setServerError(localizeAuthError(err, t));
      setSubmitting(false);
    }
  }

  function finish(): void {
    if (shareReturn === null) {
      show({ kind: 'success', message: t('account.toastCreatedConfirm', { email }) });
      void navigate({ to: FIRST_STEPS_PATH });
      return;
    }
    clearShareReturn();
    const owner = origin === null ? null : ofOwner(t, origin.ownerName);
    const key = origin?.kind === 'list' ? 'account.toastCreatedBackList' : 'account.toastCreatedBackDeck';
    show({
      kind: 'success',
      message: owner === null ? t('account.toastCreatedConfirm', { email }) : t(key, { ofOwner: owner }),
    });
    router.history.push(shareReturn.returnTo);
  }

  function closePassword(): void {
    setWithPassword(false);
    setPassword('');
    setPasswordError(false);
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.emailBox}>
        <p className={styles.emailText}>
          {t('account.newFirstTime')} <strong>{email}</strong>.
        </p>
        <button type="button" className={styles.linkBtn} onClick={onWrongEmail}>
          {t('account.wrongEmail')}
        </button>
      </div>

      {withPassword && (
        <>
          <label className={styles.label} htmlFor="new-account-password">
            {t('account.passwordLabel')}
          </label>
          <input
            id="new-account-password"
            ref={passwordRef}
            className={styles.input}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={passwordError ? 'true' : undefined}
            aria-describedby="new-account-password-rule"
          />
          <p id="new-account-password-rule" className={passwordError ? styles.fieldError : styles.note}>
            {passwordError ? t('account.passwordTooShort') : t('account.passwordRule')}
          </p>
          <p className={styles.note}>{t('account.passwordBenefit')}</p>
        </>
      )}
      {serverError !== '' && (
        <p className={styles.fieldError} role="alert">
          {serverError}
        </p>
      )}

      <button
        type="submit"
        className={styles.primaryBtn}
        aria-disabled={submitting ? 'true' : undefined}
        aria-busy={submitting ? 'true' : undefined}
      >
        {submitting
          ? t('account.creating')
          : withPassword
            ? t('account.createWithPassword')
            : t('account.createAndEnter')}
      </button>
      <button
        type="button"
        className={`${styles.linkBtn} ${styles.linkBtnCentered}`}
        onClick={withPassword ? closePassword : () => setWithPassword(true)}
      >
        {withPassword ? t('account.createWithoutPassword') : t('account.preferPassword')}
      </button>

      <p className={styles.note}>
        {t('account.stayingIn', { device: t(isPhone ? 'account.deviceThisPhone' : 'account.deviceThisComputer') })}
      </p>
    </form>
  );
}
