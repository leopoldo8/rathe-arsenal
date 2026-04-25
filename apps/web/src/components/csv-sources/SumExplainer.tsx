import React, { useState } from 'react';
import * as Collapsible from '@radix-ui/react-collapsible';
import styles from './SumExplainer.module.css';

/**
 * SumExplainer — collapsible info panel explaining the sum-not-overwrite
 * behaviour for duplicate card identifiers across multiple CSV sources.
 *
 * Uses Radix `Collapsible` for accessibility (keyboard + screen-reader).
 */
export function SumExplainer(): React.ReactElement {
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
            How duplicate cards are handled
          </button>
        </Collapsible.Trigger>
      </div>

      <Collapsible.Content className={styles.content}>
        <p className={styles.body}>
          Cards that appear in multiple CSV sources are <strong>summed</strong>,
          not overwritten. Your total owned copies reflect the combined quantities
          across all active sources.
        </p>

        {/* Visual two-box-plus-total diagram */}
        <div className={styles.diagram} aria-label="Sum diagram: Source A + Source B = Total">
          <div className={styles.diagramBox}>
            <span className={styles.diagramLabel}>Source A</span>
            <span className={styles.diagramValue}>3×</span>
            <span className={styles.diagramCard}>Lightning Press</span>
          </div>

          <span className={styles.diagramPlus} aria-hidden="true">+</span>

          <div className={styles.diagramBox}>
            <span className={styles.diagramLabel}>Source B</span>
            <span className={styles.diagramValue}>2×</span>
            <span className={styles.diagramCard}>Lightning Press</span>
          </div>

          <span className={styles.diagramEquals} aria-hidden="true">=</span>

          <div className={`${styles.diagramBox} ${styles.diagramTotal}`}>
            <span className={styles.diagramLabel}>Total</span>
            <span className={styles.diagramValue}>5×</span>
            <span className={styles.diagramCard}>Lightning Press</span>
          </div>
        </div>

        <p className={styles.footnote}>
          To avoid double-counting physical cards you own, deactivate sources you no
          longer need rather than deleting them.
        </p>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
