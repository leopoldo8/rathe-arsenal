import React, { useId, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import type { IDeckDetailResponse } from '../../api/deck-detail';
import type { ITagResponse } from '../../api/tags';
import type { TDeckStatus } from '../../api/decks';
import { usePatchDeckMutation } from '../../api/decks';
import { useNavigationAwayGuard } from '../../hooks/useNavigationAwayGuard';
import { DiscardChangesConfirm } from '../deck-detail/DiscardChangesConfirm';
import { FormatDropdown } from '../deck-detail/FormatDropdown';
import { TagChipRow } from '../deck-detail/TagChipRow';
import { DeckDangerZone } from './DeckDangerZone';
import { DeckStatusSegments } from './DeckStatusSegments';
import {
  NAME_MAX_LENGTH,
  NOTES_MAX_LENGTH,
  buildPatchBody,
  countChanges,
  fieldsFromDeck,
  isNameValid,
  type IDeckEditFields,
} from './deckEditModel';
import styles from './DeckEditForm.module.css';

interface IDeckEditFormProps {
  readonly deck: IDeckDetailResponse;
  readonly tags: readonly ITagResponse[];
}

interface IPendingNavigation {
  readonly proceed: () => void;
  readonly stay: () => void;
}

export function DeckEditForm({ deck, tags }: IDeckEditFormProps): React.ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const nameId = useId();
  const notesId = useId();
  const tagsLabelId = useId();
  const patchMutation = usePatchDeckMutation(deck.id);

  const initial = fieldsFromDeck(deck);
  const [draft, setDraft] = useState<IDeckEditFields>(initial);
  const [saveFailed, setSaveFailed] = useState(false);
  const [pending, setPending] = useState<IPendingNavigation | null>(null);
  const pendingRef = useRef<IPendingNavigation | null>(null);

  const changeCount = countChanges(initial, draft);
  const isDirty = changeCount > 0;
  const nameValid = isNameValid(draft.name);
  const canSave = isDirty && nameValid && !patchMutation.isPending;

  const guard = useNavigationAwayGuard({
    isDirty,
    isEditMode: true,
    onBlock: (proceed, stay) => {
      const next = { proceed, stay };
      pendingRef.current = next;
      setPending(next);
    },
  });

  function goToDeck(): void {
    void navigate({
      to: '/decks/$deckId',
      params: { deckId: String(deck.id) },
      search: { edit: undefined },
    });
  }

  function patchDraft(change: Partial<IDeckEditFields>): void {
    setSaveFailed(false);
    setDraft((current) => ({ ...current, ...change }));
  }

  function handleSave(): void {
    if (!canSave) return;
    setSaveFailed(false);
    patchMutation.mutate(buildPatchBody(initial, draft), {
      onSuccess: () => {
        guard.bypassNext();
        goToDeck();
      },
      onError: () => setSaveFailed(true),
    });
  }

  function resolvePending(decision: 'proceed' | 'stay'): void {
    const current = pendingRef.current;
    pendingRef.current = null;
    setPending(null);
    current?.[decision]();
  }

  return (
    <div className={styles.stack}>
      <section className={styles.panel} data-testid="deck-edit-panel">
        <div className={styles.field}>
          <label className={styles.label} htmlFor={nameId}>
            {t('deckEdit.nameLabel')}
          </label>
          <input
            id={nameId}
            className={styles.input}
            type="text"
            value={draft.name}
            maxLength={NAME_MAX_LENGTH}
            aria-invalid={!nameValid}
            aria-describedby={nameValid ? undefined : `${nameId}-error`}
            onChange={(event) => patchDraft({ name: event.currentTarget.value })}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleSave();
            }}
            data-testid="deck-edit-name"
          />
          {!nameValid && (
            <p id={`${nameId}-error`} className={styles.fieldError} role="alert">
              {t('deckEdit.nameRequired')}
            </p>
          )}
        </div>

        <div className={styles.field}>
          <FormatDropdown
            value={draft.format}
            label={t('deckEdit.formatLabel')}
            onChange={(format) => patchDraft({ format })}
          />
        </div>

        <div className={styles.field}>
          <span className={styles.label}>{t('deckEdit.statusLabel')}</span>
          <DeckStatusSegments
            value={draft.status}
            onChange={(status: TDeckStatus) => patchDraft({ status })}
          />
        </div>

        <div className={styles.field}>
          <span id={tagsLabelId} className={styles.label}>
            {t('deckEdit.tagsLabel')}
          </span>
          <TagChipRow deckId={deck.id} tags={tags} />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={notesId}>
            {t('deckEdit.notesLabel')}
          </label>
          <textarea
            id={notesId}
            className={styles.textarea}
            value={draft.notes}
            maxLength={NOTES_MAX_LENGTH}
            placeholder={t('deckEdit.notesPlaceholder')}
            onChange={(event) => patchDraft({ notes: event.currentTarget.value })}
            data-testid="deck-edit-notes"
          />
        </div>

        {saveFailed && (
          <p className={styles.saveError} role="alert" data-testid="deck-edit-save-error">
            {t('deckEdit.saveError')}
          </p>
        )}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.saveBtn}
            disabled={!canSave}
            onClick={handleSave}
            data-testid="deck-edit-save"
          >
            {patchMutation.isPending ? t('deckEdit.saving') : t('deckEdit.save')}
          </button>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={goToDeck}
            data-testid="deck-edit-cancel"
          >
            {t('deckEdit.cancel')}
          </button>
        </div>
      </section>

      <DeckDangerZone
        deckId={deck.id}
        deckName={deck.name}
        status={initial.status}
        onRetired={() => patchDraft({ status: 'retired' })}
      />

      <DiscardChangesConfirm
        open={pending !== null}
        changeCount={changeCount}
        onKeepEditing={() => resolvePending('stay')}
        onDiscard={() => resolvePending('proceed')}
      />
    </div>
  );
}
