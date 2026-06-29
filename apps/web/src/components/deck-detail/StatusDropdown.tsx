import * as Select from '@radix-ui/react-select';
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TDeckStatus } from '../../api/decks';
import { usePatchDeckMutation } from '../../api/decks';
import { useToast } from '../ui/Toast/useToast';
import { StatusBullet } from './StatusBullet';
import { STATUS_KEY_MAP } from './status-labels';
import styles from './StatusDropdown.module.css';

const ALL_STATUSES: readonly TDeckStatus[] = [
  'idea',
  'building',
  'ready',
  'active',
  'retired',
];


interface IStatusDropdownProps {
  /** The deck whose status we are editing. */
  readonly deckId: number;
  /** Current status value shown in the trigger. */
  readonly currentStatus: TDeckStatus;
}

/**
 * StatusDropdown — Radix `Select` wrapping all 5 TDeckStatus values.
 *
 * - Trigger shows current StatusBullet + label + chevron.
 * - Selecting fires usePatchDeckMutation({ status }).
 * - While in flight: trigger is disabled + spinner replaces chevron.
 * - On error: reverts optimistic local state, shows toast with retry.
 *
 * ARIA: trigger carries aria-label="Change deck status — currently {label}"
 * per R19b.
 */
export function StatusDropdown({
  deckId,
  currentStatus,
}: IStatusDropdownProps): React.ReactElement {
  const { t } = useTranslation();
  const { show: showToast } = useToast();
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  // Local optimistic state so the trigger updates immediately before the
  // server confirms — reverted to `previousStatus` on mutation error.
  const [localStatus, setLocalStatus] = useState<TDeckStatus>(currentStatus);
  // Keep a ref to previous so we can revert without a second render
  const previousStatusRef = useRef<TDeckStatus>(currentStatus);

  // Sync external prop changes (e.g. query refetch after another session)
  // when not mid-flight.
  const patchMutation = usePatchDeckMutation(deckId);

  function handleValueChange(value: string): void {
    const nextStatus = value as TDeckStatus;
    if (nextStatus === localStatus) return;

    previousStatusRef.current = localStatus;
    setLocalStatus(nextStatus);

    patchMutation.mutate(
      { status: nextStatus },
      {
        onError: () => {
          // Revert optimistic update
          setLocalStatus(previousStatusRef.current);
          showToast({
            kind: 'error',
            message: t('decks.statusUpdateError'),
            retry: () => {
              patchMutation.mutate({ status: nextStatus });
            },
            returnFocusRef: triggerRef,
          });
        },
      },
    );
  }

  const isInFlight = patchMutation.isPending;
  const currentLabel = t(STATUS_KEY_MAP[localStatus]);

  return (
    <Select.Root
      value={localStatus}
      onValueChange={handleValueChange}
      disabled={isInFlight}
    >
      <Select.Trigger
        ref={triggerRef}
        className={styles.trigger}
        aria-label={t('decks.changeStatusAria', { label: currentLabel })}
      >
        <StatusBullet status={localStatus} />
        <span className={styles.triggerIcon} aria-hidden="true">
          {isInFlight ? (
            <span className={styles.spinner} aria-hidden="true" />
          ) : (
            /* Simple chevron-down using a Unicode character */
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M2 4L6 8L10 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </span>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content className={styles.content} position="popper" sideOffset={4}>
          <Select.Viewport className={styles.viewport}>
            {ALL_STATUSES.map((status) => (
              <Select.Item key={status} value={status} className={styles.item}>
                <Select.ItemText>
                  <StatusBullet status={status} />
                </Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
