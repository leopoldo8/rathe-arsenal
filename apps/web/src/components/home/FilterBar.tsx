import React from 'react';
import { useTranslation } from 'react-i18next';
import { TagFilterChips } from './TagFilterChips';
import styles from './FilterBar.module.css';

interface IFilterBarProps {
  readonly query: string;
  readonly onQueryChange: (query: string) => void;
  readonly availableTags: readonly string[];
  readonly activeFilterTags: readonly string[];
  readonly onTagsChange: (tags: readonly string[]) => void;
}

export function FilterBar({
  query,
  onQueryChange,
  availableTags,
  activeFilterTags,
  onTagsChange,
}: IFilterBarProps): React.ReactElement {
  const { t } = useTranslation();
  return (
    <div className={styles.bar}>
      <div className={styles.searchWrap}>
        <span className={styles.searchIcon} aria-hidden="true">
          ⌕
        </span>
        <input
          type="search"
          className={styles.search}
          value={query}
          placeholder={t('home.searchPlaceholder')}
          aria-label={t('home.searchAriaLabel')}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </div>
      <TagFilterChips
        availableTags={availableTags}
        activeFilterTags={activeFilterTags}
        onFilterChange={onTagsChange}
      />
    </div>
  );
}
