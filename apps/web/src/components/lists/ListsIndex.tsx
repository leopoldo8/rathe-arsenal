import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useListsQuery, type TListKind } from '../../api/lists';
import { Button } from '../ui/Button/Button';
import { ListCard } from './ListCard';
import { NewListDialog } from './NewListDialog';
import { groupListsByKind } from './listsModel';
import styles from './ListsIndex.module.css';

interface IDialogState {
  readonly open: boolean;
  readonly kind: TListKind;
}

function PlusIcon(): React.ReactElement {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

export function ListsIndex(): React.ReactElement {
  const { t } = useTranslation();
  const query = useListsQuery();
  const [dialog, setDialog] = useState<IDialogState>({ open: false, kind: 'want' });
  const lists = query.data ?? [];
  const groups = groupListsByKind(lists);
  const openDialog = (kind: TListKind): void => setDialog({ open: true, kind });

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <h1 className={styles.h1}>{t('lists.title')}</h1>
        {lists.length > 0 && (
          <Button leftIcon={<PlusIcon />} onClick={() => openDialog('want')}>
            <span className={styles.newLong}>{t('lists.newList')}</span>
            <span className={styles.newShort}>{t('lists.newListShort')}</span>
          </Button>
        )}
      </div>

      {query.isPending && <p className={styles.status} role="status">{t('lists.loading')}</p>}
      {query.isError && (
        <div className={styles.status} role="alert">
          <p>{t('lists.loadFailed')}</p>
          <Button variant="secondary" onClick={() => void query.refetch()}>{t('lists.retry')}</Button>
        </div>
      )}

      {query.isSuccess && lists.length === 0 && (
        <>
          <p className={styles.intro}>{t('lists.empty.intro')}</p>
          <div className={styles.empty}>
            <div className={styles.emptyBox}>
              <span className={`${styles.chip} ${styles.chipWant}`}>{t('lists.kind.want')}</span>
              <h2 className={styles.emptyTitle}>{t('lists.empty.wantTitle')}</h2>
              <p className={styles.emptyBody}>{t('lists.empty.wantBody')}</p>
              <Button variant="secondary" onClick={() => openDialog('want')}>{t('lists.empty.wantCta')}</Button>
            </div>
            <div className={styles.emptyBox}>
              <span className={`${styles.chip} ${styles.chipSell}`}>{t('lists.kind.sell')}</span>
              <h2 className={styles.emptyTitle}>{t('lists.empty.sellTitle')}</h2>
              <p className={styles.emptyBody}>{t('lists.empty.sellBody')}</p>
              <Button variant="secondary" onClick={() => openDialog('sell')}>{t('lists.empty.sellCta')}</Button>
            </div>
          </div>
        </>
      )}

      {query.isSuccess && lists.length > 0 && (
        <div className={styles.columns}>
          <section aria-labelledby="lists-want-heading">
            <div className={styles.sectionHead}>
              <h2 id="lists-want-heading" className={styles.h2}>{t('lists.kind.want')}</h2>
              <span className={styles.hint}>{t('lists.sectionWantHint')}</span>
            </div>
            <ul className={styles.cards} data-testid="lists-want">
              {groups.want.map((list) => <ListCard key={list.id} list={list} />)}
            </ul>
          </section>
          <section aria-labelledby="lists-sell-heading">
            <div className={styles.sectionHead}>
              <h2 id="lists-sell-heading" className={styles.h2}>{t('lists.kind.sell')}</h2>
              <span className={styles.hint}>{t('lists.sectionSellHint')}</span>
            </div>
            <ul className={styles.cards} data-testid="lists-sell">
              {groups.sell.map((list) => <ListCard key={list.id} list={list} />)}
            </ul>
          </section>
        </div>
      )}

      {dialog.open && (
        <NewListDialog
          key={dialog.kind}
          open
          initialKind={dialog.kind}
          onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}
        />
      )}
    </div>
  );
}
