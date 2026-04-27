import React, { useEffect, useRef } from 'react';
import styles from './Skeleton.module.css';
import { setCssVar } from '../../../lib/dom/setCssVar';

interface ISkeletonProps {
  /** Explicit width (CSS value). Defaults to '100%'. */
  readonly width?: string | number;
  /** Explicit height (CSS value). Required for non-inline use. Defaults to '1em'. */
  readonly height?: string | number;
  /** Apply full border-radius (pill shape) — useful for avatar placeholders. */
  readonly rounded?: boolean;
  /** Additional CSS class for custom layout overrides. */
  readonly className?: string;
  /** Accessible label for screen readers. Defaults to 'Loading'. */
  readonly 'aria-label'?: string;
}

/**
 * Skeleton — content placeholder with shimmer animation.
 *
 * CSS-only shimmer via background-position animation.
 * Respects `prefers-reduced-motion`: when reduced motion is requested
 * the shimmer animation is suppressed and a static muted background remains.
 *
 * Width/height are bridged to CSS custom properties via a ref so the inline
 * `style` prop is never set — the public API (width/height props) is unchanged
 * for callers; the migration is internal.
 */
export function Skeleton({
  width = '100%',
  height = '1em',
  rounded = false,
  className,
  'aria-label': ariaLabel = 'Loading',
}: ISkeletonProps): React.ReactElement {
  const classes = [
    styles.skeleton,
    rounded ? styles['skeleton--rounded'] : null,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const elRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    setCssVar(elRef.current, '--ra-skeleton-width', typeof width === 'number' ? `${width}px` : width);
    setCssVar(elRef.current, '--ra-skeleton-height', typeof height === 'number' ? `${height}px` : height);
  }, [width, height]);

  return (
    <span
      ref={elRef}
      role="status"
      aria-label={ariaLabel}
      aria-busy="true"
      className={classes}
    />
  );
}
