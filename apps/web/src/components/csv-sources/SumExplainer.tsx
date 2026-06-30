import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Collapsible from '@radix-ui/react-collapsible';
import styles from './SumExplainer.module.css';

/**
 * SumExplainer — collapsible info panel explaining the sum-not-overwrite
 * behaviour for duplicate card identifiers across multiple CSV sources.
 *
 * Uses Radix `Collapsible` for accessibility (keyboard + screen-reader).
 */
export function SumExplainer(): React.ReactElement {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      className={styles.root}
    >
      <div className={styles.header}>
        <Collapsible.Trigger asChild>
          <button
            type="button"
            className={styles.trigger}
            aria-expanded={open}
          >
            <span className={styles.triggerIcon} aria-hidden="true">
              {open ? '▾' : '▸'}
            </span>
            {t('csvSources.sumExplainerTrigger')}
          </button>
        </Collapsible.Trigger>
      </div>

      <Collapsible.Content className={styles.content}>
        <p className={styles.body}>
          {t('csvSources.sumExplainerBodyPre')} <strong>{t('csvSources.sumExplainerBodyHighlight')}</strong>{t('csvSources.sumExplainerBodyPost')}
        </p>

        {/* Visual two-box-plus-total diagram */}
        <div className={styles.diagram} aria-label={t('csvSources.sumExplainerDiagramAriaLabel')}>
          <div className={styles.diagramBox}>
            <span className={styles.diagramLabel}>{t('csvSources.sumExplainerSourceA')}</span>
            <span className={styles.diagramValue}>3×</span>
            <span className={styles.diagramCard}>Lightning Press</span>
          </div>

          <span className={styles.diagramPlus} aria-hidden="true">+</span>

          <div className={styles.diagramBox}>
            <span className={styles.diagramLabel}>{t('csvSources.sumExplainerSourceB')}</span>
            <span className={styles.diagramValue}>2×</span>
            <span className={styles.diagramCard}>Lightning Press</span>
          </div>

          <span className={styles.diagramEquals} aria-hidden="true">=</span>

          <div className={`${styles.diagramBox} ${styles.diagramTotal}`}>
            <span className={styles.diagramLabel}>{t('csvSources.sumExplainerTotal')}</span>
            <span className={styles.diagramValue}>5×</span>
            <span className={styles.diagramCard}>Lightning Press</span>
          </div>
        </div>

        <p className={styles.footnote}>
          {t('csvSources.sumExplainerFootnote')}
        </p>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
