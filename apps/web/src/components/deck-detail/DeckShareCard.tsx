import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DISPLAY_NAME_REQUIRED,
  isShareErrorCode,
  patchDisplayName,
  sharedDeckImageDownloadPath,
  sharedDeckImagePath,
  useDeckShareQuery,
  useDisableDeckShareMutation,
  useEnableDeckShareMutation,
} from '../../api/shared-decks';
import { useAuth } from '../../auth/useAuth';
import { AuthFetchError } from '../../lib/auth-fetch';
import { DeckShareContact } from './DeckShareContact';
import { DisplayNameForm } from './DisplayNameForm';
import styles from './DeckShareCard.module.css';

const COPIED_FEEDBACK_MS = 2000;

type TPhase = 'idle' | 'prompt' | 'confirmOff';

interface IDeckShareCardProps {
  readonly deckId: number;
  readonly deckName: string;
}

/**
 * Sharing card on the deck detail: the on/off switch, the address with a copy
 * button, a link to the missing view and the link image download (only while
 * sharing is on). First time sharing, the API answers DISPLAY_NAME_REQUIRED
 * and the card asks for the name before retrying.
 */
export function DeckShareCard({ deckId, deckName }: IDeckShareCardProps): React.ReactElement {
  const { t } = useTranslation();
  const { token: authToken, user, setDisplayName } = useAuth();
  const shareQuery = useDeckShareQuery(deckId);
  const enable = useEnableDeckShareMutation(deckId);
  const disable = useDisableDeckShareMutation(deckId);
  const [phase, setPhase] = useState<TPhase>('idle');
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (resetTimer.current !== null) clearTimeout(resetTimer.current);
    },
    [],
  );

  const state = shareQuery.data;
  const shareToken = state?.token ?? null;
  const shareUrl = state?.url ?? null;
  const isOn = shareToken !== null && shareUrl !== null;
  const switchedOn = isOn || phase === 'prompt';
  const busy = enable.isPending || disable.isPending || savingName;

  function turnOn(): void {
    setMessage(null);
    enable.mutate(undefined, {
      onSuccess: () => setPhase('idle'),
      onError: (error) => {
        if (isShareErrorCode(error, DISPLAY_NAME_REQUIRED)) {
          setPhase('prompt');
          return;
        }
        setMessage(t('sharing.card.enableFailed'));
      },
    });
  }

  function handleSwitch(): void {
    if (busy) return;
    if (isOn) {
      setPhase('confirmOff');
      return;
    }
    if (phase === 'prompt') return;
    turnOn();
  }

  function handleTurnOff(): void {
    setMessage(null);
    disable.mutate(undefined, {
      onSuccess: () => setPhase('idle'),
      onError: () => setMessage(t('sharing.card.disableFailed')),
    });
  }

  async function handleSaveName(name: string): Promise<void> {
    setSavingName(true);
    setNameError(null);
    try {
      const saved = await patchDisplayName(name, authToken);
      setDisplayName(saved.displayName);
      setSavingName(false);
      turnOn();
    } catch (error) {
      setSavingName(false);
      setNameError(
        error instanceof AuthFetchError && error.status === 400
          ? t('sharing.displayName.invalid')
          : t('sharing.displayName.saveFailed'),
      );
    }
  }

  async function handleCopy(): Promise<void> {
    if (shareUrl === null) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
    if (resetTimer.current !== null) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopyState('idle'), COPIED_FEEDBACK_MS);
  }

  return (
    <section className={styles.card} aria-labelledby="deck-share-eyebrow" data-testid="deck-share-card">
      <div className={styles.head}>
        <div className={styles.headText}>
          <p id="deck-share-eyebrow" className={styles.eyebrow}>
            {t('sharing.card.eyebrow')}
          </p>
          <h2 className={styles.title}>{isOn ? t('sharing.card.onTitle') : t('sharing.card.offTitle')}</h2>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={switchedOn}
          aria-label={t('sharing.card.switchAria')}
          aria-disabled={busy || shareQuery.isLoading ? 'true' : undefined}
          className={styles.switch}
          data-on={switchedOn}
          onClick={handleSwitch}
          data-testid="deck-share-switch"
        >
          <span className={styles.knob} aria-hidden="true" />
        </button>
      </div>

      {shareQuery.isError && (
        <p className={styles.error} role="alert">
          {t('sharing.card.loadFailed')}{' '}
          <button type="button" className={styles.linkBtn} onClick={() => void shareQuery.refetch()}>
            {t('sharing.card.retry')}
          </button>
        </p>
      )}

      {phase === 'prompt' && (
        <DisplayNameForm
          initialName={user?.displayName ?? ''}
          saving={savingName}
          error={nameError}
          submitLabel={t('sharing.displayName.activate')}
          onSubmit={(name) => void handleSaveName(name)}
          onCancel={() => {
            setPhase('idle');
            setNameError(null);
          }}
        />
      )}

      {!isOn && phase === 'idle' && !shareQuery.isError && <p className={styles.copy}>{t('sharing.card.offBody')}</p>}

      {isOn && phase !== 'confirmOff' && (
        <>
          <label className={styles.label} htmlFor="deck-share-address">
            {t('sharing.card.addressLabel')}
          </label>
          <div className={styles.addressRow}>
            <input
              id="deck-share-address"
              className={styles.address}
              type="text"
              readOnly
              value={shareUrl}
              onFocus={(event) => event.currentTarget.select()}
              data-testid="deck-share-address"
            />
            <button type="button" className={styles.copyBtn} onClick={() => void handleCopy()}>
              {copyState === 'copied' ? t('sharing.card.copied') : t('sharing.card.copy')}
            </button>
          </div>
          <p className={styles.status} role="status">
            {copyState === 'failed' ? t('sharing.card.copyFailed') : ''}
          </p>
          <p className={styles.copy}>
            {user?.displayName ? (
              <>
                {t('sharing.card.appearsAsPrefix')} <b>{user.displayName}</b>. {t('sharing.card.appearsAsSuffix')}
              </>
            ) : (
              t('sharing.card.appearsAsFallback')
            )}
          </p>
          <a
            className={styles.link}
            href={`${shareUrl}?view=missing`}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="deck-share-missing-link"
          >
            {t('sharing.card.missingLink')}
          </a>
          <DeckShareContact deckId={deckId} deckName={deckName} showContact={state?.showContact ?? false} />
          <p className={styles.label}>{t('sharing.card.imageLabel')}</p>
          <img
            className={styles.preview}
            src={sharedDeckImagePath(shareToken)}
            alt={t('sharing.card.imageAlt')}
            loading="lazy"
            width={1200}
            height={630}
          />
          <p className={styles.note}>{t('sharing.card.imageNote')}</p>
          <a
            className={styles.download}
            href={sharedDeckImageDownloadPath(shareToken)}
            download
            data-testid="deck-share-download"
          >
            {t('sharing.card.download')}
          </a>
        </>
      )}

      {isOn && phase === 'confirmOff' && (
        <div className={styles.confirm} role="group" aria-labelledby="deck-share-confirm-title">
          <p id="deck-share-confirm-title" className={styles.confirmTitle}>
            {t('sharing.card.offConfirmTitle')}
          </p>
          <p className={styles.copy}>{t('sharing.card.offConfirmBody')}</p>
          <p className={styles.note}>{t('sharing.card.offConfirmNote')}</p>
          <div className={styles.confirmActions}>
            <button type="button" className={styles.dangerBtn} onClick={handleTurnOff} aria-disabled={busy || undefined}>
              {t('sharing.card.offConfirm')}
            </button>
            <button type="button" className={styles.ghostBtn} onClick={() => setPhase('idle')}>
              {t('sharing.card.keepOn')}
            </button>
          </div>
        </div>
      )}

      {message !== null && (
        <p className={styles.error} role="alert">
          {message}
        </p>
      )}
    </section>
  );
}
