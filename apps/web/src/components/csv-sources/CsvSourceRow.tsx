import React, { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Switch from '@radix-ui/react-switch';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Link } from '@tanstack/react-router';
import type { ICsvSource } from '../../api/csv-sources';
import { usePatchCsvSourceMutation } from '../../api/csv-sources';
import { useToast } from '../ui/Toast/useToast';
import { DeleteSourceModal } from './DeleteSourceModal';
import { deriveSourceKind } from './source-kind';
import styles from './CsvSourceRow.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ICsvSourceRowProps {
  readonly source: ICsvSource;
  /** Lines of this import still kept "Para resolver". */
  readonly pendingCount?: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * CsvSourceRow — one import of "Importações" (r3-imports-phone): its name, copies and the lines still
 * to resolve, the link to its versions, the switch that turns it on or off, and a chevron.
 *
 * Features:
 * - Inline label edit (click label → input; Enter/Blur → save)
 * - Radix Switch for active toggle (optimistic update via React Query)
 * - Overflow menu (Radix DropdownMenu) with Rename + Delete actions
 * - Delete opens DeleteSourceModal
 */
export function CsvSourceRow({ source, pendingCount = 0 }: ICsvSourceRowProps): React.ReactElement {
  const { t } = useTranslation();
  const { show } = useToast();
  const patchMutation = usePatchCsvSourceMutation();

  const switchId = useId();
  const labelInputId = useId();

  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState('');
  const labelInputRef = useRef<HTMLInputElement | null>(null);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const kind = deriveSourceKind(source);
  const isManual = kind === 'manual';
  const displayLabel = isManual
    ? t('csvSources.manualSourceLabel')
    : (source.label ?? source.originalFilename ?? t('csvSources.untitledSourceLabel'));
  const versionsPath = { to: '/library-csv-sources/$sourceId/versions', params: { sourceId: source.id } } as const;

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
  }

  // Select the label once the input is mounted. Doing it in an animation frame let the selection land
  // after the first keystroke under load, and the next key then replaced that character.
  useEffect(() => {
    if (editingLabel) labelInputRef.current?.select();
  }, [editingLabel]);

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
      <div
        className={`${styles.row} ${source.active ? '' : styles['row--inactive']}`}
        role="listitem"
        data-kind={kind}
      >
        {/* Label */}
        <div className={styles.labelCell}>
          <p className={styles.title}>
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
            ) : isManual ? (
              <span className={styles.labelText}>{displayLabel}</span>
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
            <span className={styles.counts}>
              {' · '}
              {t('collectionReader.copiesCount', { count: source.copies })}
              {pendingCount > 0 && (
                <>
                  {' · '}
                  <span title={t('collectionReader.linesToResolve', { count: pendingCount })}>
                    {t('collectionReader.toResolve', { count: pendingCount })}
                  </span>
                </>
              )}
            </span>
          </p>

          <Link {...versionsPath} className={styles.versionsLink}>
            {t('copyVersions.rowLink')}
          </Link>
        </div>

        {isManual ? (
          <p className={styles.manualNote}>{t('csvSources.manualAlwaysIncluded')}</p>
        ) : (
          <>
            <Switch.Root
              id={switchId}
              checked={source.active}
              onCheckedChange={handleToggle}
              className={styles.switch}
              aria-label={t('csvSources.toggleAriaLabel', { label: displayLabel })}
            >
              <Switch.Thumb className={styles.switchThumb} />
            </Switch.Root>

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
          </>
        )}

        <Link {...versionsPath} className={styles.chevron} aria-hidden="true" tabIndex={-1}>
          ›
        </Link>
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
