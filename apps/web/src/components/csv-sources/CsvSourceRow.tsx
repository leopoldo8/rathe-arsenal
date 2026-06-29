import React, { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Switch from '@radix-ui/react-switch';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import type { ICsvSource } from '../../api/csv-sources';
import { usePatchCsvSourceMutation } from '../../api/csv-sources';
import { useToast } from '../ui/Toast/useToast';
import { DeleteSourceModal } from './DeleteSourceModal';
import { formatRelativeTime } from '../../utils/format-relative-time';
import styles from './CsvSourceRow.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ICsvSourceRowProps {
  readonly source: ICsvSource;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * CsvSourceRow — renders a single CSV source as a list row.
 *
 * Features:
 * - Inline label edit (click label → input; Enter/Blur → save)
 * - Radix Switch for active toggle (optimistic update via React Query)
 * - Overflow menu (Radix DropdownMenu) with Rename + Delete actions
 * - Delete opens DeleteSourceModal
 */
export function CsvSourceRow({ source }: ICsvSourceRowProps): React.ReactElement {
  const { t } = useTranslation();
  const { show } = useToast();
  const patchMutation = usePatchCsvSourceMutation();

  const switchId = useId();
  const labelInputId = useId();

  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState('');
  const labelInputRef = useRef<HTMLInputElement | null>(null);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const displayLabel = source.label ?? source.originalFilename ?? 'Untitled CSV';
  const cardCount = source.cardCount ?? 0;
  const relativeDate = formatRelativeTime(source.createdAt);

  // Toggle active (optimistic)
  function handleToggle(checked: boolean): void {
    patchMutation.mutate(
      { sourceId: source.id, active: checked },
      {
        onError: () => {
          show({ kind: 'error', message: t('csvSources.updateSourceError') });
        },
      },
    );
  }

  // Start inline label edit
  function startEdit(): void {
    setLabelDraft(displayLabel);
    setEditingLabel(true);
    requestAnimationFrame(() => {
      labelInputRef.current?.select();
    });
  }

  // Commit the label edit
  function commitEdit(): void {
    const trimmed = labelDraft.trim();
    setEditingLabel(false);
    if (trimmed.length === 0 || trimmed === displayLabel) return;

    patchMutation.mutate(
      { sourceId: source.id, label: trimmed },
      {
        onError: () => {
          show({ kind: 'error', message: t('csvSources.renameSourceError') });
        },
      },
    );
  }

  function handleLabelKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') {
      commitEdit();
    }
    if (e.key === 'Escape') {
      setEditingLabel(false);
    }
  }

  return (
    <>
      <div className={styles.row} role="listitem">
        {/* Active toggle */}
        <Switch.Root
          id={switchId}
          checked={source.active}
          onCheckedChange={handleToggle}
          className={styles.switch}
          aria-label={t('csvSources.toggleAriaLabel', { label: displayLabel })}
        >
          <Switch.Thumb className={styles.switchThumb} />
        </Switch.Root>

        {/* Label */}
        <div className={styles.labelCell}>
          {editingLabel ? (
            <input
              ref={labelInputRef}
              id={labelInputId}
              type="text"
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={handleLabelKeyDown}
              className={styles.labelInput}
              aria-label={t('csvSources.editSourceNameAriaLabel')}
              aria-describedby={`${labelInputId}-hint`}
              autoComplete="off"
            />
          ) : (
            <button
              type="button"
              className={styles.labelBtn}
              onClick={startEdit}
              aria-label={t('csvSources.renameAriaLabel', { label: displayLabel })}
              title={t('csvSources.renameTitle')}
            >
              {displayLabel}
            </button>
          )}

          {source.originalFilename !== null && source.label !== null && (
            <span className={styles.filename}>{source.originalFilename}</span>
          )}
        </div>

        {/* Metadata */}
        <div className={styles.meta}>
          <span className={styles.cardCount}>
            {cardCount.toLocaleString()} {cardCount !== 1 ? t('csvSources.cardPlural') : t('csvSources.cardSingular')}
          </span>
          <span className={styles.date} title={new Date(source.createdAt).toLocaleString()}>
            {relativeDate}
          </span>
        </div>

        {/* Overflow menu */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className={styles.menuTrigger}
              aria-label={t('csvSources.optionsAriaLabel', { label: displayLabel })}
            >
              •••
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className={styles.menuContent}
              align="end"
              sideOffset={4}
            >
              <DropdownMenu.Item
                className={styles.menuItem}
                onSelect={startEdit}
              >
                {t('csvSources.renameMenuItem')}
              </DropdownMenu.Item>
              <DropdownMenu.Separator className={styles.menuSeparator} />
              <DropdownMenu.Item
                className={`${styles.menuItem} ${styles.menuItemDestructive}`}
                onSelect={() => setDeleteModalOpen(true)}
              >
                {t('csvSources.deleteMenuItem')}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      {deleteModalOpen && (
        <DeleteSourceModal
          open={deleteModalOpen}
          source={source}
          onClose={() => setDeleteModalOpen(false)}
          onDeleted={() => setDeleteModalOpen(false)}
        />
      )}
    </>
  );
}
