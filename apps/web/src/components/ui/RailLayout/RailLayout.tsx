import React from 'react';
import styles from './RailLayout.module.css';

export type TRailOnPhone = 'hidden' | 'below' | 'above';

interface IRailLayoutProps {
  /** Back link and title; drawn above the split on every width. */
  readonly head?: React.ReactNode;
  /** The left rail: the steps, a section index, or the other ways in. */
  /** Nothing (null, false) draws the content alone, full width. */
  readonly rail: React.ReactNode;
  /** Names the rail for screen readers. */
  readonly railLabel: string;
  /** From desktop width the rail sits at the left; on a phone it is hidden or drawn after the content. */
  readonly railOnPhone?: TRailOnPhone;
  readonly children: React.ReactNode;
  readonly testId?: string | undefined;
  /** Extra class on the frame, for the page's own desktop adjustments. */
  readonly className?: string | undefined;
}

/**
 * The page layout of forms and steps: from 960 px a rail at the left and the content in the remaining
 * width, inside the same container as the top bar and footer. Below 960 px it is the single column the
 * phone design already has, so a page that adopts it keeps its phone layout.
 */
export function RailLayout({ head, rail, railLabel, railOnPhone = 'hidden', children, testId, className }: IRailLayoutProps): React.ReactElement {
  const railElement = (
    <aside className={styles.rail} aria-label={railLabel} data-testid="rail">
      {rail}
    </aside>
  );
  const hasRail = rail !== null && rail !== undefined && rail !== false;
  return (
    <div className={className === undefined ? styles.frame : `${styles.frame} ${className}`} data-testid={testId}>
      {head}
      <div className={styles.split} data-rail-on-phone={railOnPhone} data-has-rail={hasRail}>
        {hasRail && railOnPhone !== 'below' && railElement}
        <div className={styles.content}>{children}</div>
        {hasRail && railOnPhone === 'below' && railElement}
      </div>
    </div>
  );
}
