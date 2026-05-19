import React, { useState } from 'react';
import type { ITagResponse } from '../../api/tags';
import { usePatchDeckMutation } from '../../api/decks';
import { TagAutocompleteCombobox } from './TagAutocompleteCombobox';
import styles from './TagChipRow.module.css';

interface ITagChipRowProps {
  /** The deck whose tags are being displayed. */
  readonly deckId: number;
  /** The current tags attached to this deck. */
  readonly tags: readonly ITagResponse[];
}

/**
 * TagChipRow — renders a horizontally-wrapped row of tag chips plus an
 * "+ add tag" button.
 *
 * Each chip:
 * - Renders tag.name as a JSX text-node (safe React text rendering).
 * - Has a remove button (×) with aria-label="Remove tag {name}" that calls
 *   usePatchDeckMutation({ removeTagIds: [id] }).
 *
 * The "+ add tag" button mounts TagAutocompleteCombobox inline when clicked.
 */
export function TagChipRow({ deckId, tags }: ITagChipRowProps): React.ReactElement {
  const [showCombobox, setShowCombobox] = useState(false);
  const patchMutation = usePatchDeckMutation(deckId);

  function handleRemoveTag(tagId: number): void {
    patchMutation.mutate({ removeTagIds: [tagId] });
  }

  return (
    <div className={styles.row} role="group" aria-label="Deck tags">
      {tags.map((tag) => (
        <span key={tag.id} className={styles.chip}>
          {/* JSX text-node: safe React rendering, no raw HTML injection */}
          <span>{tag.name}</span>
          <button
            type="button"
            className={styles.removeBtn}
            aria-label={`Remove tag ${tag.name}`}
            onClick={() => handleRemoveTag(tag.id)}
          >
            <span aria-hidden="true">×</span>
          </button>
        </span>
      ))}

      {showCombobox ? (
        <TagAutocompleteCombobox
          deckId={deckId}
          existingTagIds={tags.map((t) => t.id)}
          onClose={() => setShowCombobox(false)}
        />
      ) : (
        <button
          type="button"
          className={styles.addBtn}
          onClick={() => setShowCombobox(true)}
          aria-label="Add a tag to this deck"
        >
          <span aria-hidden="true">+</span>
          <span>add tag</span>
        </button>
      )}
    </div>
  );
}
