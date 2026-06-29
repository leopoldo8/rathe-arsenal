import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './Button.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type TButtonSize = 'sm' | 'md' | 'lg';

export interface IButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'disabled'> {
  /** Visual style variant. Defaults to 'primary'. */
  readonly variant?: TButtonVariant;
  /** Size preset. Defaults to 'md'. Min touch target 44x44px applies to all. */
  readonly size?: TButtonSize;
  /** When true, replaces children with a spinner and sets aria-busy. */
  readonly loading?: boolean;
  /** When true, sets aria-disabled and prevents interaction. */
  readonly disabled?: boolean;
  /** Optional icon rendered left of children. */
  readonly leftIcon?: React.ReactNode;
  /** Optional icon rendered right of children. */
  readonly rightIcon?: React.ReactNode;
  readonly children: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Button — base interactive primitive.
 *
 * Variants: primary | secondary | ghost | danger
 * Sizes: sm | md | lg — ALL respect the 44x44px minimum touch target (R52).
 * Loading state: replaces children with a spinner, sets aria-busy="true".
 * Disabled state: uses aria-disabled (not the native disabled attribute) so
 *   the element remains focusable for screen reader enumeration.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  children,
  className,
  onClick,
  type = 'button',
  ...rest
}: IButtonProps): React.ReactElement {
  const { t } = useTranslation();
  const isDisabled = disabled || loading;

  const classes = [
    styles.button,
    styles[`button--${variant}`],
    styles[`button--${size}`],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>): void => {
    if (isDisabled) return;
    onClick?.(event);
  };

  // aria-disabled does not prevent keyboard Enter/Space activation the way
  // native `disabled` does. Block those events explicitly so keyboard users
  // get the same disabled experience as mouse users.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>): void => {
    if (isDisabled && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
    }
  };

  return (
    <button
      type={type}
      className={classes}
      aria-busy={loading ? 'true' : undefined}
      aria-disabled={isDisabled ? 'true' : undefined}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      {...rest}
    >
      {loading ? (
        <>
          <span className={styles.spinner} aria-hidden="true" />
          <span className="sr-only">{t('common.loading')}</span>
        </>
      ) : (
        <>
          {leftIcon != null && (
            <span className={styles.iconLeft} aria-hidden="true">
              {leftIcon}
            </span>
          )}
          {children}
          {rightIcon != null && (
            <span className={styles.iconRight} aria-hidden="true">
              {rightIcon}
            </span>
          )}
        </>
      )}
    </button>
  );
}
