import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './TagFilterChips.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ITagFilterChipsProps {
  /**
   * All distinct tags available for filtering, derived from the user's decks
   * (or from useTagsQuery). Displayed as toggleable chips.
   */
  readonly availableTags: readonly string[];
  /**
   * Currently active tag filter values (from URL search params).
   * Chips whose name appears here are shown in the selected/highlighted state.
   */
  readonly activeFilterTags: readonly string[];
  /**
   * Called when the active tag set should change. The parent (home.tsx) owns
   * the navigate call so the URL update uses the properly-typed route search
   * schema rather than a generic any-typed function form.
   */
  readonly onFilterChange: (newTags: readonly string[]) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * TagFilterChips — a row of toggle buttons for OR-logic tag filtering.
 *
 * The parent (home.tsx) owns the URL navigate call via `onFilterChange`
 * so this component stays route-agnostic and properly typed.
 *
 * Behaviour:
 *  - Selected chips are visually highlighted (border + background tint).
 *  - A "Clear" link appears when ≥1 chip is active.
 *  - Renders nothing when there are no available tags.
 */
export function TagFilterChips({
  availableTags,
  activeFilterTags,
  onFilterChange,
}: ITagFilterChipsProps): React.ReactElement | null {
  const { t } = useTranslation();
  if (availableTags.length === 0) return null;

  function handleToggle(tag: string): void {
    const isActive = activeFilterTags.includes(tag);
    const newTags = isActive
      ? activeFilterTags.filter((activeTag) => activeTag !== tag)
      : [...activeFilterTags, tag];
    onFilterChange(newTags);
  }

  function handleClear(): void {
    onFilterChange([]);
  }

  const hasActive = activeFilterTags.length > 0;

  return (
    <div className={styles.container} role="group" aria-label={t('home.filterByTagGroupLabel')}>
      <span className={styles.label} aria-hidden="true">
        {t('home.tagsLabel')}
      </span>
      <div className={styles.chips}>
        {availableTags.map((tag) => {
          const isActive = activeFilterTags.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              className={`${styles.chip} ${isActive ? styles.chipActive : ''}`}
              onClick={() => handleToggle(tag)}
              aria-pressed={isActive}
              aria-label={t('home.filterByTagAriaLabel', { tag })}
            >
              {tag}
            </button>
          );
        })}
      </div>
      {hasActive && (
        <button
          type="button"
          className={styles.clearBtn}
          onClick={handleClear}
          aria-label={t('home.clearAllTagFiltersAriaLabel')}
        >
          {t('home.clearButton')}
        </button>
      )}
    </div>
  );
}
