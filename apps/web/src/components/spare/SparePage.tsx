import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSpareQuery, type ISpareResponse, type ISpareRow } from '../../api/spare';
import { cardName } from '../../lib/card-name';
import { Skeleton } from '../ui/Skeleton/Skeleton';
import { plural, ruleLine, rowKey, versionText } from './spareModel';
import { SpareRuleSheet } from './SpareRuleSheet';
import { WhySpareSheet } from './WhySpareSheet';
import styles from './SparePage.module.css';

interface ISparePageProps {
  /** Back to the collection. */
  readonly onBack: () => void;
}

type TView = { readonly kind: 'list' } | { readonly kind: 'rule' } | { readonly kind: 'why'; readonly row: ISpareRow };

interface ISpareRowItemProps {
  readonly row: ISpareRow;
  readonly rows: readonly ISpareRow[];
  readonly onWhy: (row: ISpareRow) => void;
}

function SpareRowItem({ row, rows, onWhy }: ISpareRowItemProps): React.ReactElement {
  const { t } = useTranslation();
  const name = cardName(row.name, row.pitch, (key) => t(key));
  const version = versionText(row, rows, t);
  return (
    <li className={styles.row} data-testid="spare-row">
      {row.imageUrl !== null && <img className={styles.art} src={row.imageUrl} alt="" loading="lazy" />}
      <div className={styles.rowText}>
        <p className={styles.name}>{name}</p>
        <p className={styles.meta}>{version === null ? t('spare.sparePlain', { count: row.spare }) : t('spare.versionLine', { version, count: row.spare })}</p>
        <button type="button" className={styles.link} onClick={() => onWhy(row)}>
          {t('spare.whySpare')}
        </button>
      </div>
    </li>
  );
}

function ruleRow(spare: ISpareResponse, onChange: () => void, t: ReturnType<typeof useTranslation>['t']): React.ReactElement | null {
  if (spare.rule === null) return null;
  return (
    <div className={styles.ruleBox}>
      <p className={styles.ruleText}>{ruleLine(spare.rule, t)}</p>
      <button type="button" className={styles.change} onClick={onChange}>
        {t('spare.change')}
      </button>
    </div>
  );
}

/** "Sobrando": every spare copy by version, under the player's rule. */
export function SparePage({ onBack }: ISparePageProps): React.ReactElement {
  const { t } = useTranslation();
  const query = useSpareQuery();
  const [view, setView] = useState<TView>({ kind: 'list' });

  if (query.isLoading) {
    return (
      <div className={styles.page} role="status" aria-label={t('spare.loading')}>
        <Skeleton height="320px" />
      </div>
    );
  }
  if (query.isError || query.data === undefined) {
    return (
      <div className={styles.page}>
        <p role="alert" className={styles.error}>
          {t('spare.loadError')}
        </p>
        <button type="button" className={styles.link} onClick={() => void query.refetch()}>
          {t('spare.retry')}
        </button>
      </div>
    );
  }

  const spare = query.data;
  if (spare.needsRule) {
    return <SpareRuleSheet counts={spare.counts} initialRule={null} backLabel={t('spare.backToCollection')} onBack={onBack} />;
  }
  if (view.kind === 'rule') {
    return (
      <SpareRuleSheet
        counts={spare.counts}
        initialRule={spare.rule}
        backLabel={t('spare.backToSpare')}
        onBack={() => setView({ kind: 'list' })}
        onSaved={() => setView({ kind: 'list' })}
      />
    );
  }
  if (view.kind === 'why') {
    return <WhySpareSheet spare={spare} row={view.row} onBack={() => setView({ kind: 'list' })} />;
  }

  return (
    <div className={styles.page} data-testid="spare-page">
      <button type="button" className={styles.back} onClick={onBack}>
        {t('spare.backToCollection')}
      </button>
      <h1 className={styles.title}>{plural(t, 'spare.title', spare.totalSpare)}</h1>
      {ruleRow(spare, () => setView({ kind: 'rule' }), t)}
      {spare.rows.length === 0 ? (
        <p className={styles.empty}>{t('spare.empty')}</p>
      ) : (
        <ul className={styles.list} aria-label={t('spare.rowList')}>
          {spare.rows.map((row) => (
            <SpareRowItem key={rowKey(row)} row={row} rows={spare.rows} onWhy={(chosen) => setView({ kind: 'why', row: chosen })} />
          ))}
        </ul>
      )}
    </div>
  );
}
