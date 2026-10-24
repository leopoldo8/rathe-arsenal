import React from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { localizeAuthError } from '../../auth/localize-auth-error';
import { useAuth } from '../../auth/useAuth';
import {
  useCopySharedDeckMutation,
  useSharedCoverageQuery,
  type ISharedDeckResponse,
} from '../../api/shared-decks';
import { VarFill } from '../deck-detail/VarFill';
import { Button } from '../ui/Button/Button';
import { writeShareReturn } from '../../lib/share-return';
import styles from './SharedComparison.module.css';

interface ISharedComparisonProps {
  readonly deck: ISharedDeckResponse;
}

/**
 * The panel beside the deck identity. Which one shows depends on who is
 * looking: the owner sees a note (no comparison, no copy), an anonymous
 * visitor sees the invitation, a signed-in visitor sees their coverage and the
 * copy action.
 */
export function SharedComparison({ deck }: ISharedComparisonProps): React.ReactElement {
  const { user } = useAuth();
  if (deck.isOwner) return <OwnerNote deckId={deck.deckId} />;
  if (user === null) return <Invitation token={deck.token} />;
  return <CoveragePanel deck={deck} />;
}

function OwnerNote({ deckId }: { readonly deckId: number | null }): React.ReactElement {
  const { t } = useTranslation();
  return (
    <aside className={styles.panel} aria-labelledby="shared-owner-title" data-testid="shared-owner-note">
      <p id="shared-owner-title" className={styles.eyebrow}>
        {t('sharing.owner.title')}
      </p>
      {deckId !== null && (
        <div className={styles.actions}>
          <Link
            to="/decks/$deckId"
            params={{ deckId: String(deckId) }}
            search={{ edit: undefined }}
            className={styles.secondaryLink}
          >
            {t('sharing.owner.manage')}
          </Link>
        </div>
      )}
    </aside>
  );
}

function Invitation({ token }: { readonly token: string }): React.ReactElement {
  const { t } = useTranslation();
  const remember = (): void => writeShareReturn(token);

  return (
    <aside className={`${styles.panel} ${styles.brass}`} aria-labelledby="shared-invite-title" data-testid="shared-invite">
      <p className={styles.eyebrow}>{t('sharing.invite.eyebrow')}</p>
      <h2 id="shared-invite-title" className={styles.title}>
        {t('sharing.invite.title')}
      </h2>
      <div className={styles.actions}>
        <Link to="/sign-up" className={styles.primaryLink} onClick={remember}>
          {t('sharing.invite.signUp')}
        </Link>
        <Link to="/sign-in" className={styles.secondaryLink} onClick={remember}>
          {t('sharing.invite.signIn')}
        </Link>
      </div>
    </aside>
  );
}

/** A new account on a shared deck owns nothing yet: say how to put cards in (journey 2's entries) instead of 0%. */
function EmptyCollectionPanel(): React.ReactElement {
  const { t } = useTranslation();
  return (
    <aside className={`${styles.panel} ${styles.brass}`} aria-labelledby="shared-coverage-title" data-testid="shared-coverage-empty">
      <p id="shared-coverage-title" className={styles.eyebrow}>
        {t('sharing.coverage.eyebrow')}
      </p>
      <p className={styles.copy}>{t('sharing.coverage.emptyCollection')}</p>
      <div className={styles.actions}>
        <Link to="/add-cards" className={styles.primaryLink}>
          {t('sharing.coverage.pasteList')}
        </Link>
        <Link to="/add-cards/csv" className={styles.secondaryLink}>
          {t('sharing.coverage.uploadSheet')}
        </Link>
      </div>
    </aside>
  );
}

function CoveragePanel({ deck }: { readonly deck: ISharedDeckResponse }): React.ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const coverage = useSharedCoverageQuery(deck.token, true);
  const copy = useCopySharedDeckMutation(deck.token);

  function handleCopy(): void {
    copy.mutate(undefined, {
      onSuccess: ({ deckId }) => {
        void navigate({ to: '/decks/$deckId', params: { deckId: String(deckId) }, search: { edit: undefined } });
      },
    });
  }

  const data = coverage.data;
  if (data?.collectionEmpty === true) return <EmptyCollectionPanel />;
  const missingCopies = data === undefined ? 0 : Math.max(0, data.totalCopies - data.ownedCopies);

  return (
    <aside className={`${styles.panel} ${styles.brass}`} aria-labelledby="shared-coverage-title" data-testid="shared-coverage">
      <p id="shared-coverage-title" className={styles.eyebrow}>
        {t('sharing.coverage.eyebrow')}
      </p>
      {coverage.isLoading && (
        <p className={styles.copy} role="status">
          {t('sharing.coverage.loading')}
        </p>
      )}
      {coverage.isError && (
        <p className={styles.copy} role="alert">
          {t('sharing.coverage.loadFailed')}
        </p>
      )}
      {data !== undefined && (
        <>
          <div className={styles.coverageRow}>
            <span className={styles.big} aria-label={t('sharing.coverage.percentAria', { percent: data.percent })}>
              {data.percent}
              <sup>%</sup>
            </span>
            <div className={styles.coverageText}>
              <p className={styles.owned}>
                {t('sharing.coverage.owned', { owned: data.ownedCopies, total: data.totalCopies })}{' '}
                <span className={styles.ownedLabel}>{t('sharing.coverage.ownedCopies')}</span>
              </p>
              <div className={styles.meter} aria-hidden="true">
                <VarFill
                  className={styles.meterFill ?? ''}
                  cssVar="--coverage-percent"
                  value={`${Math.min(100, Math.max(0, data.percent))}%`}
                />
              </div>
            </div>
          </div>
          <p className={styles.note}>
            {missingCopies === 0
              ? t('sharing.coverage.complete')
              : t('sharing.coverage.missing', { count: missingCopies })}
          </p>
        </>
      )}
      <div className={styles.actions}>
        <Button variant="primary" onClick={handleCopy} loading={copy.isPending}>
          {t('sharing.coverage.copy')}
        </Button>
      </div>
      {copy.isError && (
        <p className={styles.error} role="alert">
          {localizeAuthError(copy.error, t)}
        </p>
      )}
    </aside>
  );
}
