import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/useAuth';
import type { TStartNext } from '../../lib/account-api';
import { CodeStep } from './CodeStep';
import { EmailStep } from './EmailStep';
import { NewAccountStep } from './NewAccountStep';
import { PasswordStep } from './PasswordStep';
import styles from './SignInSheet.module.css';

type TStep =
  | { readonly kind: 'email'; readonly email: string }
  | { readonly kind: 'new'; readonly email: string }
  | { readonly kind: 'password'; readonly email: string }
  | { readonly kind: 'code'; readonly email: string };

/**
 * The server ended the session while the player was on a page (AC 239). The page stays mounted
 * underneath, so a deck's draft is still in it; this sheet signs in again over it and goes away, and
 * the page's data is fetched again with the new session.
 */
function SignInSheetBody({ email }: { readonly email: string }): React.ReactElement {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<TStep>({ kind: 'email', email });

  function backToEmail(address: string): void {
    setStep({ kind: 'email', email: address });
  }

  function resolved(address: string, next: TStartNext): void {
    setStep({ kind: next === 'new' ? 'new' : next === 'password' ? 'password' : 'code', email: address });
  }

  function signedIn(): void {
    void queryClient.invalidateQueries();
  }

  return (
    <>
      <Dialog.Title className={styles.title}>{t('account.signInTitle')}</Dialog.Title>
      {step.kind === 'email' && <EmailStep compact initialEmail={step.email} fromSharedPage={false} origin={null} onResolved={resolved} />}
      {step.kind === 'password' && (
        <PasswordStep
          email={step.email}
          onChangeEmail={() => backToEmail(step.email)}
          onUseCode={() => setStep({ kind: 'code', email: step.email })}
          onSignedIn={signedIn}
        />
      )}
      {step.kind === 'code' && (
        <CodeStep email={step.email} onChangeEmail={() => backToEmail(step.email)} onSignedIn={signedIn} />
      )}
      {step.kind === 'new' && (
        <NewAccountStep email={step.email} shareReturn={null} origin={null} onWrongEmail={() => backToEmail(step.email)} />
      )}
    </>
  );
}

export function SignInSheet(): React.ReactElement | null {
  const { user, sessionEnded } = useAuth();
  if (sessionEnded !== true || user === null) return null;
  return (
    <Dialog.Root open>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content
          className={styles.panel}
          aria-describedby={undefined}
          onEscapeKeyDown={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
          data-testid="sign-in-sheet"
        >
          <SignInSheetBody email={user.email} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
