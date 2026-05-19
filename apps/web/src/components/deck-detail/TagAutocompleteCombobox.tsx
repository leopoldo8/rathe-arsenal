import React, {
  useEffect,
  useId,
  useRef,
  useState,
  useCallback,
} from 'react';
import { usePatchDeckMutation } from '../../api/decks';
import { useCreateTagMutation, useTagsQuery } from '../../api/tags';
import type { ITagResponse } from '../../api/tags';
import styles from './TagAutocompleteCombobox.module.css';

interface ITagAutocompleteComboboxProps {
  /** The deck to which we are attaching a tag. */
  readonly deckId: number;
  /** Tag IDs already attached — excluded from the filtered list. */
  readonly existingTagIds: readonly number[];
  /** Called after the user dismisses / completes interaction. */
  readonly onClose: () => void;
}

/** Error state variants the combobox can surface inline. */
type TInlineError =
  | { kind: '422-cap' }
  | { kind: '5xx-create'; retry: () => void }
  | { kind: 'partial-failure'; newTagName: string }
  | { kind: '5xx-attach' };

/**
 * TagAutocompleteCombobox — WAI-ARIA 1.1 combobox for attaching tags.
 *
 * Behaviour:
 * - Filters useTagsQuery results client-side (case-insensitive) minus already
 *   attached tag IDs.
 * - If no exact match: last item is `Create "{typed}"`.
 * - Enter on existing → usePatchDeckMutation({ addTagIds: [id] }).
 * - Enter on Create → useCreateTagMutation({ name }) then
 *   usePatchDeckMutation({ addTagIds: [newId] }).
 * - All error states are surfaced inline in the dropdown footer.
 * - Escape closes without attaching; typed text is preserved.
 * - Errors clear on user input or successful action.
 *
 * ARIA: input has role="combobox", listbox below, options have role="option".
 */
export function TagAutocompleteCombobox({
  deckId,
  existingTagIds,
  onClose,
}: ITagAutocompleteComboboxProps): React.ReactElement {
  const inputId = useId();
  const listboxId = useId();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [inlineError, setInlineError] = useState<TInlineError | null>(null);
  // After a partial failure (create succeeded, attach failed), we track the
  // newly-created tag so it appears in the filtered list.
  const [recentlyCreatedTag, setRecentlyCreatedTag] = useState<ITagResponse | null>(null);

  const tagsQuery = useTagsQuery();
  const createTagMutation = useCreateTagMutation();
  const patchMutation = usePatchDeckMutation(deckId);

  // Focus input on mount
  useEffect(() => {
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, []);

  // Click-outside closes the combobox
  useEffect(() => {
    function handlePointerDown(e: PointerEvent): void {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [onClose]);

  // Build filtered options list
  const allTags: readonly ITagResponse[] = tagsQuery.data?.tags ?? [];
  const queryLower = query.trim().toLowerCase();

  // Merge recentlyCreatedTag into allTags if not yet in the query cache
  const mergedTags = recentlyCreatedTag
    ? allTags.some((t) => t.id === recentlyCreatedTag.id)
      ? allTags
      : [...allTags, recentlyCreatedTag]
    : allTags;

  const filteredTags = mergedTags.filter((tag) => {
    if (existingTagIds.includes(tag.id)) return false;
    if (queryLower === '') return true;
    return tag.name.toLowerCase().includes(queryLower);
  });

  const exactMatch = filteredTags.find(
    (t) => t.name.toLowerCase() === queryLower,
  );
  const showCreateOption =
    queryLower.length > 0 && !exactMatch;

  // Total number of items in the listbox (filtered tags + optional Create item)
  const itemCount = filteredTags.length + (showCreateOption ? 1 : 0);
  const createOptionIndex = filteredTags.length; // last item when shown

  const isOpen = query.length > 0 || filteredTags.length > 0;

  function clearError(): void {
    setInlineError(null);
  }

  function handleQueryChange(e: React.ChangeEvent<HTMLInputElement>): void {
    setQuery(e.target.value);
    setActiveIndex(-1);
    clearError();
  }

  const attachExistingTag = useCallback(
    (tag: ITagResponse) => {
      patchMutation.mutate(
        { addTagIds: [tag.id] },
        {
          onSuccess: () => {
            setQuery('');
            setActiveIndex(-1);
            clearError();
            onClose();
          },
          onError: () => {
            setInlineError({ kind: '5xx-attach' });
          },
        },
      );
    },
    [patchMutation, onClose],
  );

  const handleCreateAndAttach = useCallback(
    (name: string) => {
      createTagMutation.mutate(
        { name },
        {
          onSuccess: (newTag) => {
            setRecentlyCreatedTag(newTag);
            patchMutation.mutate(
              { addTagIds: [newTag.id] },
              {
                onSuccess: () => {
                  setQuery('');
                  setActiveIndex(-1);
                  setRecentlyCreatedTag(null);
                  clearError();
                  onClose();
                },
                onError: () => {
                  // Partial failure: tag created but not attached.
                  setInlineError({ kind: 'partial-failure', newTagName: newTag.name });
                },
              },
            );
          },
          onError: (err) => {
            // Inspect error status if available
            const status =
              err != null &&
              typeof err === 'object' &&
              'status' in err
                ? (err as { status: number }).status
                : 0;
            if (status === 422) {
              setInlineError({ kind: '422-cap' });
            } else {
              setInlineError({
                kind: '5xx-create',
                retry: () => handleCreateAndAttach(name),
              });
            }
          },
        },
      );
    },
    [createTagMutation, patchMutation, onClose],
  );

  function handleSelectIndex(index: number): void {
    if (index < filteredTags.length) {
      const tag = filteredTags[index];
      if (tag) attachExistingTag(tag);
    } else if (showCreateOption && index === createOptionIndex) {
      handleCreateAndAttach(query.trim());
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (!isOpen && e.key !== 'Escape') return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((prev) =>
          itemCount === 0 ? -1 : Math.min(prev + 1, itemCount - 1),
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((prev) => (prev <= 0 ? -1 : prev - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0) {
          handleSelectIndex(activeIndex);
        } else if (filteredTags.length === 1 && !showCreateOption) {
          const singleTag = filteredTags[0];
          if (singleTag) attachExistingTag(singleTag);
        } else if (showCreateOption && filteredTags.length === 0) {
          handleCreateAndAttach(query.trim());
        } else if (exactMatch) {
          attachExistingTag(exactMatch);
        } else if (showCreateOption) {
          // Default: if typed something and Create is available, create it
          handleCreateAndAttach(query.trim());
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }

  // Generate stable option IDs for aria-activedescendant
  function getOptionId(index: number): string {
    return `${listboxId}-opt-${index}`;
  }

  const activeDescendant =
    activeIndex >= 0 ? getOptionId(activeIndex) : undefined;

  return (
    <div ref={wrapperRef} className={styles.wrapper}>
      <input
        ref={inputRef}
        id={inputId}
        className={styles.input}
        role="combobox"
        aria-label="Search or create a tag"
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={isOpen}
        aria-activedescendant={activeDescendant}
        value={query}
        onChange={handleQueryChange}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        spellCheck={false}
      />

      {isOpen ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Tag suggestions"
          className={styles.listbox}
        >
          {filteredTags.map((tag, i) => (
            <li
              key={tag.id}
              id={getOptionId(i)}
              role="option"
              aria-selected={i === activeIndex}
              className={`${styles.option}${i === activeIndex ? ` ${styles['option--active']}` : ''}`}
              onPointerDown={(e) => {
                // Prevent blur on the input before we can handle the click
                e.preventDefault();
                attachExistingTag(tag);
              }}
            >
              {/* JSX text-node: safe React rendering */}
              {tag.name}
            </li>
          ))}

          {showCreateOption ? (
            <li
              id={getOptionId(createOptionIndex)}
              role="option"
              aria-selected={createOptionIndex === activeIndex}
              className={`${styles.option} ${styles.createOption}${createOptionIndex === activeIndex ? ` ${styles['option--active']}` : ''}`}
              onPointerDown={(e) => {
                e.preventDefault();
                handleCreateAndAttach(query.trim());
              }}
            >
              {/* JSX text-node: safe React rendering */}
              Create &ldquo;{query.trim()}&rdquo;
            </li>
          ) : null}

          {/* Inline error footer */}
          {inlineError !== null ? (
            <li
              role="status"
              aria-live="polite"
              className={styles.errorFooter}
            >
              {inlineError.kind === '422-cap' ? (
                <span>
                  You&rsquo;ve reached the 200-tag limit. Remove an unused tag first.
                </span>
              ) : inlineError.kind === '5xx-create' ? (
                <>
                  <span>Couldn&rsquo;t create the tag — try again.</span>
                  <button
                    type="button"
                    className={styles.retryBtn}
                    onClick={inlineError.retry}
                  >
                    Retry
                  </button>
                </>
              ) : inlineError.kind === 'partial-failure' ? (
                <span>
                  Tag created but couldn&rsquo;t attach — pick it from the list.
                </span>
              ) : inlineError.kind === '5xx-attach' ? (
                <span>Couldn&rsquo;t attach the tag — try again.</span>
              ) : null}
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
