import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './ListEditor.module.css';

interface IInlineTextProps {
  readonly value: string;
  readonly label: string;
  readonly editLabel: string;
  readonly multiline?: boolean;
  readonly maxLength: number;
  readonly placeholder?: string;
  readonly allowEmpty: boolean;
  readonly children: (open: () => void) => React.ReactNode;
  readonly onSave: (value: string) => void;
}

/** Shows `children` until opened, then a field that saves on Enter or Save and drops on Escape. */
export function InlineText({
  value,
  label,
  editLabel,
  multiline = false,
  maxLength,
  placeholder,
  allowEmpty,
  children,
  onSave,
}: IInlineTextProps): React.ReactElement {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<string | null>(null);

  if (draft === null) return <>{children(() => setDraft(value))}</>;

  function commit(): void {
    const next = (draft ?? '').trim();
    setDraft(null);
    if (next === value || (!allowEmpty && next === '')) return;
    onSave(next);
  }

  function onKeyDown(event: React.KeyboardEvent): void {
    if (event.key === 'Escape') setDraft(null);
    if (event.key === 'Enter' && (!multiline || event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      commit();
    }
  }

  const shared = {
    'aria-label': label || editLabel,
    value: draft,
    maxLength,
    placeholder,
    autoFocus: true,
    className: styles.inlineField,
    onKeyDown,
  };

  return (
    <span className={styles.inlineEdit}>
      {multiline ? (
        <textarea {...shared} rows={3} onChange={(event) => setDraft(event.currentTarget.value)} />
      ) : (
        <input {...shared} type="text" onChange={(event) => setDraft(event.currentTarget.value)} />
      )}
      <span className={styles.inlineActions}>
        <button type="button" className={styles.smallBtn} onClick={commit}>{t('lists.editor.save')}</button>
        <button type="button" className={styles.smallBtnQuiet} onClick={() => setDraft(null)}>{t('lists.editor.cancel')}</button>
      </span>
    </span>
  );
}
