import React, { useEffect, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import type { ISharedListResponse } from '../../api/shared-lists';
import { useAuth } from '../../auth/useAuth';
import { writeShareReturn } from '../../lib/share-return';
import { formatBrl, buildListText, makeTranslate } from '../lists/listsModel';
import { SharedContactButton } from '../shared-deck/SharedContactButton';
import { hasAvailableLines, sellSummary, wantSummary, type TMatchesByLine } from './sharedListModel';
import styles from './SharedListPage.module.css';

const COPIED_FEEDBACK_MS = 2000;

interface ISharedListAsideProps {
  readonly list: ISharedListResponse;
  readonly matches: TMatchesByLine;
}

function CopyGlyph(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

/** The side column: who shares what, the set price, the note, copy as text, and the visitor's own card. */
export function SharedListAside({ list, matches }: ISharedListAsideProps): React.ReactElement {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isWant = list.kind === 'want';
  const hasContact = list.contactWhatsapp !== null;

  return (
    <aside className={styles.aside} aria-labelledby="shared-list-title">
      <div className={styles.identity}>
        <span className={`${styles.kind} ${isWant ? styles.kindWant : styles.kindSell}`} data-testid="shared-list-kind">
          {t(`lists.kind.${list.kind}`)}
        </span>
        <h1 id="shared-list-title" className={styles.title}>
          {list.name}
        </h1>
        <div className={styles.whoRow}>
          <p className={styles.who}>
            <b>{list.sharerName}</b> {t(isWant ? 'sharing.sharedList.whoWant' : 'sharing.sharedList.whoSell')}
          </p>
          {hasContact && (
            <SharedContactButton
              variant="pill"
              primary
              whatsapp={list.contactWhatsapp ?? ''}
              sharerName={list.sharerName}
              message={t('sharing.sharedList.contactMessage', { list: list.name })}
            />
          )}
        </div>
      </div>

      {list.totalPriceCents !== null && (
        <div className={styles.total} data-testid="shared-list-total">
          {t('sharing.sharedList.allForPrefix')} <b>{formatBrl(list.totalPriceCents)}</b>
        </div>
      )}

      {list.notes !== null && list.notes !== '' && (
        <div className={styles.notes} data-testid="shared-list-notes">
          <span className={styles.notesCap}>{t('sharing.sharedList.notesCap', { name: list.sharerName })}</span>
          <p className={styles.notesText}>{list.notes}</p>
        </div>
      )}

      <CopyListButton list={list} />

      {list.isOwner && list.listId !== null && (
        <Link to="/lists/$listId" params={{ listId: String(list.listId) }} className={styles.manage}>
          {t('sharing.sharedList.manage')}
        </Link>
      )}
      {user === null && <Invitation list={list} pinned={!hasContact} />}
      {user !== null && !list.isOwner && <VisitorSummary list={list} matches={matches} />}
    </aside>
  );
}

function CopyListButton({ list }: { readonly list: ISharedListResponse }): React.ReactElement {
  const { t } = useTranslation();
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  async function handleCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(buildListText(list, makeTranslate(t), list.url));
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopyState('idle'), COPIED_FEEDBACK_MS);
  }

  return (
    <>
      <button
        type="button"
        className={styles.copyBtn}
        disabled={!hasAvailableLines(list.lines)}
        onClick={() => void handleCopy()}
        data-testid="shared-copy-list"
      >
        <CopyGlyph />
        {copyState === 'copied' ? t('sharing.wanted.copied') : t('sharing.wanted.copyList')}
      </button>
      <p className={styles.status} role="status">
        {copyState === 'failed' ? t('sharing.wanted.copyFailed') : ''}
      </p>
    </>
  );
}

interface IInvitationProps {
  readonly list: ISharedListResponse;
  /** On phones, sits as a fixed bottom bar; otherwise it is a card at the end of the side column. */
  readonly pinned: boolean;
}

function Invitation({ list, pinned }: IInvitationProps): React.ReactElement {
  const { t } = useTranslation();
  const remember = (): void => writeShareReturn(list.token, 'l');

  return (
    <section
      className={pinned ? `${styles.invite} ${styles.invitePinned}` : styles.invite}
      aria-labelledby="shared-list-invite-title"
      data-testid="shared-invite"
    >
      <h2 id="shared-list-invite-title" className={styles.inviteTitle}>
        {t(list.kind === 'want' ? 'sharing.sharedList.inviteWant' : 'sharing.sharedList.inviteSell')}
      </h2>
      <div className={styles.inviteActions}>
        <Link to="/sign-up" className={styles.primaryLink} onClick={remember}>
          {t('sharing.invite.signUp')}
        </Link>
        <Link to="/sign-in" className={styles.secondaryLink} onClick={remember}>
          {t('sharing.invite.signIn')}
        </Link>
      </div>
    </section>
  );
}

function VisitorSummary({ list, matches }: { readonly list: ISharedListResponse; readonly matches: TMatchesByLine }): React.ReactElement | null {
  const { t } = useTranslation();
  if (matches.size === 0) return null;
  const isWant = list.kind === 'want';
  const { count, total } = isWant ? wantSummary(list.lines, matches) : sellSummary(list.lines, matches);
  const text = isWant
    ? count > 0
      ? t('sharing.sharedList.summaryWant', { count: total, owned: count })
      : t('sharing.sharedList.summaryWantNone')
    : count > 0
      ? t('sharing.sharedList.summarySell', { count })
      : t('sharing.sharedList.summarySellNone');
  const good = isWant ? count > 0 : count === 0;

  return (
    <p className={`${styles.summary} ${good ? styles.summaryGood : styles.summaryWarn}`} data-testid="shared-list-summary">
      {text}
    </p>
  );
}
