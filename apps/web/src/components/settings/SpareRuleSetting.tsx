import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSpareQuery } from '../../api/spare';
import { ruleLine } from '../spare/spareModel';
import { SpareRuleSheet } from '../spare/SpareRuleSheet';
import styles from './SpareRuleSetting.module.css';

/** "Cartas sobrando" panel of Settings: the player's rule for passing cards between decks, asked as the spare page asks it. */
export function SpareRuleSetting({ className }: { readonly className?: string | undefined }): React.ReactElement | null {
  const { t } = useTranslation();
  const query = useSpareQuery();
  const [changing, setChanging] = useState(false);
  const spare = query.data;
  if (spare === undefined) return null;

  if (changing) {
    return (
      <SpareRuleSheet
        counts={spare.counts}
        initialRule={spare.rule}
        backLabel={t('spare.backToSettings')}
        onBack={() => setChanging(false)}
        onSaved={() => setChanging(false)}
      />
    );
  }

  return (
    <section className={className ?? styles.section} aria-labelledby="section-spare-rule">
      <h2 id="section-spare-rule" className={styles.heading}>
        {t('spare.settingsHeading')}
      </h2>
      <div className={styles.row}>
        <p className={styles.text}>{spare.rule === null ? t('spare.settingsRuleUnset') : ruleLine(spare.rule, t)}</p>
        <button type="button" className={styles.button} onClick={() => setChanging(true)}>
          {spare.rule === null ? t('spare.settingsChoose') : t('spare.change')}
        </button>
      </div>
    </section>
  );
}
