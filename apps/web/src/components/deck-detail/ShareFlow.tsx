import React, { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useTranslation } from 'react-i18next';
import {
  DISPLAY_NAME_REQUIRED,
  isShareErrorCode,
  patchDisplayName,
  useDeckShareQuery,
  useEnableDeckShareMutation,
  type TShareIntent,
} from '../../api/shared-decks';
import { useAuth } from '../../auth/useAuth';
import { AuthFetchError } from '../../lib/auth-fetch';
import { DisplayNameForm } from './DisplayNameForm';
import { ShareIntentStep } from './ShareIntentStep';
import { ShareLinkStep } from './ShareLinkStep';
import styles from './ShareFlow.module.css';

type TStep =
  | { readonly kind: 'name'; readonly then: TShareIntent | null }
  | { readonly kind: 'intent' }
  | { readonly kind: 'link'; readonly intent: TShareIntent };

interface IShareFlowProps {
  readonly deckId: number;
  readonly deckName: string;
  readonly missingCount: number;
  readonly initialIntent: TShareIntent | null;
  readonly onClose: () => void;
}

function firstStep(hasName: boolean, initialIntent: TShareIntent | null): TStep {
  if (!hasName) return { kind: 'name', then: initialIntent };
  return initialIntent === null ? { kind: 'intent' } : { kind: 'link', intent: initialIntent };
}

/** The three steps of sharing: your name (only if missing), what to share, the link. Mounted while the dialog is open. */
export function ShareFlow({ deckId, deckName, missingCount, initialIntent, onClose }: IShareFlowProps): React.ReactElement {
  const { t } = useTranslation();
  const { token: authToken, user, setDisplayName } = useAuth();
  const shareQuery = useDeckShareQuery(deckId);
  const enable = useEnableDeckShareMutation(deckId);
  const [step, setStep] = useState<TStep>(() => firstStep(Boolean(user?.displayName), initialIntent));
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const autoStarted = useRef(false);

  function activate(intent: TShareIntent): void {
    setStep({ kind: 'link', intent });
    if (shareQuery.data?.[intent] != null) return;
    enable.reset();
    enable.mutate(intent, {
      onError: (error) => {
        if (isShareErrorCode(error, DISPLAY_NAME_REQUIRED)) setStep({ kind: 'name', then: intent });
      },
    });
  }

  useEffect(() => {
    if (autoStarted.current || initialIntent === null || !user?.displayName) return;
    autoStarted.current = true;
    activate(initialIntent);
    // Runs once on open: the call to action jumps straight to its link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSaveName(name: string): Promise<void> {
    setSavingName(true);
    setNameError(null);
    try {
      const saved = await patchDisplayName(name, authToken);
      setDisplayName(saved.displayName);
      setSavingName(false);
      if (step.kind === 'name' && step.then !== null) activate(step.then);
      else setStep({ kind: 'intent' });
    } catch (error) {
      setSavingName(false);
      setNameError(
        error instanceof AuthFetchError && error.status === 400
          ? t('sharing.displayName.invalid')
          : t('sharing.displayName.saveFailed'),
      );
    }
  }

  const title =
    step.kind === 'name'
      ? t('sharing.dialog.name.title')
      : step.kind === 'intent'
        ? t('sharing.dialog.title')
        : t(`sharing.dialog.intent.${step.intent}.title`);
  const link = step.kind === 'link' ? (shareQuery.data?.[step.intent] ?? null) : null;

  return (
    <>
      <div className={styles.header}>
        {step.kind === 'link' && (
          <button
            type="button"
            className={styles.iconBtn}
            aria-label={t('sharing.dialog.back')}
            onClick={() => setStep({ kind: 'intent' })}
            data-testid="share-back"
          >
            <span aria-hidden="true" className={styles.backGlyph}>&#8249;</span>
          </button>
        )}
        <Dialog.Title className={styles.title}>{title}</Dialog.Title>
        <Dialog.Close className={styles.iconBtn} aria-label={t('sharing.dialog.close')}>
          <span aria-hidden="true">&#10005;</span>
        </Dialog.Close>
      </div>

      <div className={styles.body}>
        {step.kind === 'name' && (
          <DisplayNameForm
            initialName={user?.displayName ?? ''}
            saving={savingName}
            error={nameError}
            submitLabel={t('sharing.dialog.name.continue')}
            onSubmit={(name) => void handleSaveName(name)}
            onCancel={onClose}
          />
        )}
        {step.kind === 'intent' && (
          <ShareIntentStep links={shareQuery.data} missingCount={missingCount} onChoose={activate} />
        )}
        {step.kind === 'link' && link !== null && (
          <ShareLinkStep
            key={link.token}
            deckId={deckId}
            deckName={deckName}
            link={link}
            onTurnedOff={() => setStep({ kind: 'intent' })}
          />
        )}
        {step.kind === 'link' && link === null && enable.isError && !isShareErrorCode(enable.error, DISPLAY_NAME_REQUIRED) && (
          <>
            <p className={styles.error} role="alert">
              {t('sharing.dialog.enableFailed')}
            </p>
            <button type="button" className={styles.secondaryBtn} onClick={() => activate(step.intent)}>
              {t('sharing.dialog.retry')}
            </button>
          </>
        )}
        {step.kind === 'link' && link === null && !enable.isError && (
          <p className={styles.placeholder} role="status">
            {t('sharing.dialog.preparing')}
          </p>
        )}
      </div>
    </>
  );
}
