import React, { useState } from 'react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { Link, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import {
  LIST_NAME_MAX,
  useDeleteListMutation,
  useListQuery,
  usePatchListMutation,
  type ICardList,
} from '../../api/lists';
import { useListShareQuery } from '../../api/shared-lists';
import { AuthFetchError } from '../../lib/auth-fetch';
import { Button } from '../ui/Button/Button';
import { AddCardDialog } from './AddCardDialog';
import { InlineText } from './InlineText';
import { LineEditPanel } from './LineEditPanel';
import { LineTile } from './LineTile';
import { ListShareDialog } from './ListShareDialog';
import { ListTotalsBar } from './ListTotalsBar';
import { versionedListUrl } from './listShareModel';
import { makeTranslate } from './listsModel';
import styles from './ListEditor.module.css';

const NOTES_MAX = 1000;

function SearchIcon(): React.ReactElement {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export function ListEditor({ listId }: { readonly listId: string }): React.ReactElement {
  const { t } = useTranslation();
  const query = useListQuery(listId);

  if (query.isPending) return <p className={styles.state} role="status">{t('lists.loading')}</p>;
  if (query.isError) {
    const missing = query.error instanceof AuthFetchError && query.error.status === 404;
    return (
      <div className={styles.state} role="alert">
        <p>{missing ? t('lists.editor.notFound') : t('lists.loadFailed')}</p>
        {missing ? (
          <Link to="/lists" className={styles.backLink}>{t('lists.editor.back')}</Link>
        ) : (
          <Button variant="secondary" onClick={() => void query.refetch()}>{t('lists.retry')}</Button>
        )}
      </div>
    );
  }
  return <ListEditorBody list={query.data} />;
}

function ListEditorBody({ list }: { readonly list: ICardList }): React.ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const patch = usePatchListMutation(list.id);
  const remove = useDeleteListMutation(list.id);
  const [selectedLineId, setSelectedLineId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [sharing, setSharing] = useState(false);
  const shareLink = useListShareQuery(list.id);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const selected = list.lines.find((line) => line.id === selectedLineId) ?? null;

  return (
    <div className={styles.page} data-kind={list.kind}>
      <nav className={styles.crumb} aria-label={t('lists.editor.breadcrumb')}>
        <Link to="/lists" className={styles.crumbLink}>{t('lists.editor.breadcrumb')}</Link>
      </nav>

      <div className={styles.head}>
        <InlineText
          value={list.name}
          label={t('lists.editor.nameLabel')}
          editLabel={t('lists.editor.rename')}
          maxLength={LIST_NAME_MAX}
          allowEmpty={false}
          onSave={(name) => patch.mutate({ name })}
        >
          {(open) => (
            <h1 className={styles.h1}>
              <button type="button" className={styles.nameButton} onClick={open} aria-label={`${t('lists.editor.rename')}: ${list.name}`}>
                {list.name}
              </button>
            </h1>
          )}
        </InlineText>
        <span className={`${styles.kindChip} ${list.kind === 'want' ? styles.kindWant : styles.kindSell}`}>
          {t(`lists.kind.${list.kind}`)}
        </span>
        <button type="button" className={styles.deleteBtn} onClick={() => setConfirmingDelete(true)}>
          {t('lists.editor.deleteList')}
        </button>
      </div>

      <div className={styles.notes}>
        <InlineText
          value={list.notes ?? ''}
          label={t('lists.editor.notes')}
          editLabel={t('lists.editor.editNotes')}
          multiline
          maxLength={NOTES_MAX}
          placeholder={t('lists.editor.notesPlaceholder')}
          allowEmpty
          onSave={(notes) => patch.mutate({ notes })}
        >
          {(open) =>
            list.notes === null ? (
              <button type="button" className={styles.textBtn} onClick={open}>{t('lists.editor.addNotes')}</button>
            ) : (
              <>
                <span className={styles.notesCap}>{t('lists.editor.notes')}</span>
                <span className={styles.notesText}>{list.notes}</span>
                <button type="button" className={styles.textBtn} onClick={open}>{t('lists.editor.editNotes')}</button>
              </>
            )
          }
        </InlineText>
      </div>
      {patch.isError && <p className={styles.fieldError} role="alert">{t('lists.editor.saveFailed')}</p>}

      <button type="button" className={styles.addBar} onClick={() => setAdding(true)}>
        <SearchIcon />
        {t('lists.editor.addCard')}
      </button>

      {list.lines.length === 0 ? (
        <p className={styles.empty}>{t(list.kind === 'want' ? 'lists.editor.emptyWant' : 'lists.editor.emptySell')}</p>
      ) : (
        <ul className={styles.grid}>
          {list.lines.map((line) => (
            <LineTile key={line.id} listId={list.id} line={line} kind={list.kind} selected={line.id === selectedLineId} onSelect={setSelectedLineId} />
          ))}
        </ul>
      )}

      <ListTotalsBar
        list={list}
        shareUrl={shareLink.data ? versionedListUrl(list, shareLink.data.url, makeTranslate(t)) : null}
        onSaveTotal={(cents) => patch.mutate({ totalPriceCents: cents })}
        onShare={() => setSharing(true)}
      />

      {selected !== null && <LineEditPanel key={selected.id} list={list} line={selected} onClose={() => setSelectedLineId(null)} />}
      <ListShareDialog list={list} open={sharing} onOpenChange={setSharing} />
      {adding && <AddCardDialog list={list} onClose={() => setAdding(false)} />}

      <AlertDialog.Root open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className={styles.alertOverlay} />
          <AlertDialog.Content className={styles.alert}>
            <AlertDialog.Title className={styles.alertTitle}>{t('lists.editor.deleteTitle')}</AlertDialog.Title>
            <AlertDialog.Description className={styles.alertBody}>{t('lists.editor.deleteBody')}</AlertDialog.Description>
            <div className={styles.alertActions}>
              <AlertDialog.Cancel asChild>
                <Button variant="secondary">{t('lists.editor.deleteCancel')}</Button>
              </AlertDialog.Cancel>
              <Button
                variant="danger"
                loading={remove.isPending}
                onClick={() => remove.mutate(undefined, { onSuccess: () => void navigate({ to: '/lists' }) })}
              >
                {t('lists.editor.deleteConfirm')}
              </Button>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  );
}
