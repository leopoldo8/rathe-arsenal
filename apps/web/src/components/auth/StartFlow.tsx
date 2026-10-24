import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useRouter } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/useAuth';
import { clearShareReturn, readShareReturn } from '../../lib/share-return';
import { readRememberedEmail } from '../../lib/remembered-account';
import type { TStartNext } from '../../lib/account-api';
import { AccountLayout } from './AccountLayout';
import { CodeStep } from './CodeStep';
import { EmailStep } from './EmailStep';
import { NewAccountStep } from './NewAccountStep';
import { PasswordStep } from './PasswordStep';
import { useShareOrigin } from './ShareOrigin';

type TStep =
  | { readonly kind: 'email'; readonly email: string }
  | { readonly kind: 'new'; readonly email: string }
  | { readonly kind: 'password'; readonly email: string }
  | { readonly kind: 'code'; readonly email: string };

interface IStartFlowProps {
  /** The single-use token an e-mailed "Entrar" button carries; it signs in on arrival. */
  readonly buttonToken?: string | undefined;
}

/**
 * The signed-out front door: one e-mail field, then whatever the address takes next (a new account,
 * a password, or an e-mailed code). Signing in sends the visitor back to the shared page they came
 * from, or to the app.
 */
export function StartFlow({ buttonToken }: IStartFlowProps): React.ReactElement {
  const { t } = useTranslation();
  const { redeemCode } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();
  // Read once: the first sign-in step clears the stored return.
  const shareReturn = useMemo(() => readShareReturn(), []);
  const origin = useShareOrigin(shareReturn);
  const [step, setStep] = useState<TStep>(() => ({ kind: 'email', email: readRememberedEmail() }));
  const [redeeming, setRedeeming] = useState(buttonToken !== undefined);
  const redeemed = useRef(false);

  function finish(): void {
    if (shareReturn !== null) {
      clearShareReturn();
      router.history.push(shareReturn.returnTo);
      return;
    }
    void navigate({ to: '/home', search: { tag: [] } });
  }

  useEffect(() => {
    // Strict mode runs effects twice; a button token signs in once.
    if (buttonToken === undefined || redeemed.current) return;
    redeemed.current = true;
    redeemCode(buttonToken)
      .then(finish)
      // A button that no longer works leaves the visitor on the plain start page.
      .catch(() => setRedeeming(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buttonToken]);

  function backToEmail(email: string): void {
    setStep({ kind: 'email', email });
  }

  function resolved(email: string, next: TStartNext): void {
    setStep({ kind: next === 'new' ? 'new' : next === 'password' ? 'password' : 'code', email });
  }

  if (redeeming) {
    return (
      <AccountLayout title={t('account.brandName')} hideTitle>
        <p role="status">{t('account.buttonSigningIn')}</p>
      </AccountLayout>
    );
  }

  switch (step.kind) {
    case 'new':
      return (
        <AccountLayout title={t('account.newTitle')}>
          <NewAccountStep
            email={step.email}
            shareReturn={shareReturn}
            origin={origin}
            onWrongEmail={() => backToEmail(step.email)}
          />
        </AccountLayout>
      );
    case 'password':
      return (
        <AccountLayout title={t('account.signInTitle')}>
          <PasswordStep
            email={step.email}
            onChangeEmail={() => backToEmail(step.email)}
            onUseCode={() => setStep({ kind: 'code', email: step.email })}
            onSignedIn={finish}
          />
        </AccountLayout>
      );
    case 'code':
      return (
        <AccountLayout title={t('account.codeTitle')}>
          <CodeStep email={step.email} onChangeEmail={() => backToEmail(step.email)} onSignedIn={finish} />
        </AccountLayout>
      );
    case 'email':
      return (
        <AccountLayout title={t('account.brandName')} hideTitle={shareReturn !== null}>
          <EmailStep
            initialEmail={step.email}
            fromSharedPage={shareReturn !== null}
            origin={origin}
            onResolved={resolved}
          />
        </AccountLayout>
      );
  }
}

/**
 * Sends a visitor whose session this device restored on page load straight to the app. A sign-in
 * made on this page is the flow's own to finish (it goes back to a shared page, or to the first
 * steps), so it never redirects over it.
 */
export function StartGate({ buttonToken }: IStartFlowProps): React.ReactElement | null {
  const { user, isLoading, restoredSession } = useAuth();
  if (isLoading) return null;
  if (user !== null && restoredSession === true) return <Navigate to="/home" search={{ tag: [] }} replace />;
  return <StartFlow buttonToken={buttonToken} />;
}
