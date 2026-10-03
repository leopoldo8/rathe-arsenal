import React, { useId, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import type { ITrackedDeckListItem } from '../../api/decks';
import { DeckTile } from './DeckTile';
import { filterByGroup, GROUP_ORDER, type THomeGroup } from './homeGroups';
import styles from './StatusGroups.module.css';

interface IStatusGroupsProps {
  readonly decks: readonly ITrackedDeckListItem[];
  readonly onUntrack: (deckId: number) => void;
  readonly untrackingDeckId: number | null;
  /** True when every tracked deck is retired, regardless of the active filters. */
  readonly isAllRetired: boolean;
}

const GROUP_LABEL_KEYS: Readonly<Record<THomeGroup, { name: string; hint: string }>> = {
  active: { name: 'home.groupActiveName', hint: 'home.groupActiveHint' },
  building: { name: 'home.groupBuildingName', hint: 'home.groupBuildingHint' },
  idea: { name: 'home.groupIdeaName', hint: 'home.groupIdeaHint' },
  retired: { name: 'home.groupRetiredName', hint: 'home.groupRetiredHint' },
};

const RETIRED_EXPANDED_KEY = 'ra-shelf-retired-expanded';

function readRetiredExpanded(): boolean {
  try {
    const raw = localStorage.getItem(RETIRED_EXPANDED_KEY);
    if (raw === null) return false;
    return JSON.parse(raw) === true;
  } catch {
    return false;
  }
}

function writeRetiredExpanded(expanded: boolean): void {
  try {
    localStorage.setItem(RETIRED_EXPANDED_KEY, JSON.stringify(expanded));
  } catch {
    // Storage unavailable: the toggle still works for this session.
  }
}

interface IDeckGridProps {
  readonly decks: readonly ITrackedDeckListItem[];
  readonly onUntrack: (deckId: number) => void;
  readonly untrackingDeckId: number | null;
  readonly id?: string;
}

function DeckGrid({ decks, onUntrack, untrackingDeckId, id }: IDeckGridProps): React.ReactElement {
  return (
    <div id={id} className={styles.deckGrid}>
      {decks.map((deck) => (
        <DeckTile
          key={deck.id}
          deck={deck}
          onUntrack={onUntrack}
          isUntracking={untrackingDeckId === deck.id}
        />
      ))}
    </div>
  );
}

interface IGroupHeadProps {
  readonly group: THomeGroup;
  readonly headingId: string;
  readonly count: number;
  readonly children?: React.ReactNode;
}

function GroupHead({ group, headingId, count, children }: IGroupHeadProps): React.ReactElement {
  const { t } = useTranslation();
  return (
    <div className={styles.groupHead}>
      <span className={styles.groupDot} data-group={group} aria-hidden="true" />
      <h2 id={headingId} className={styles.groupHeading}>
        {t(GROUP_LABEL_KEYS[group].name)}
      </h2>
      <span className={styles.groupHint}>{t(GROUP_LABEL_KEYS[group].hint)}</span>
      <span className={styles.groupCount}>
        {count === 1 ? t('home.deckCountSingular') : t('home.deckCountPlural', { count })}
      </span>
      {children}
    </div>
  );
}

interface IRetiredGroupProps {
  readonly decks: readonly ITrackedDeckListItem[];
  readonly headingId: string;
  readonly onUntrack: (deckId: number) => void;
  readonly untrackingDeckId: number | null;
  readonly isAllRetired: boolean;
}

function RetiredGroup({
  decks,
  headingId,
  onUntrack,
  untrackingDeckId,
  isAllRetired,
}: IRetiredGroupProps): React.ReactElement {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<boolean>(readRetiredExpanded);

  function handleToggle(): void {
    const next = !expanded;
    setExpanded(next);
    writeRetiredExpanded(next);
  }

  return (
    <section className={styles.group} aria-labelledby={headingId}>
      <GroupHead group="retired" headingId={headingId} count={decks.length}>
        <button
          type="button"
          className={styles.retiredToggle}
          aria-expanded={expanded}
          aria-controls={`${headingId}-content`}
          onClick={handleToggle}
          aria-label={
            expanded ? t('home.retiredCollapseAriaLabel') : t('home.retiredExpandAriaLabel')
          }
        >
          <span
            className={`${styles.chevron} ${expanded ? styles.chevronUp : ''}`}
            aria-hidden="true"
          />
        </button>
      </GroupHead>

      {isAllRetired && !expanded && (
        <div className={styles.allRetiredEmptyState}>
          {t('home.allRetiredEmptyState')}{' '}
          <button type="button" className={styles.allRetiredExpandBtn} onClick={handleToggle}>
            {t('home.expandToView')}
          </button>{' '}
          ·{' '}
          <Link to="/decks/new" className={styles.allRetiredAddLink}>
            {t('home.addNewDeckLink')}
          </Link>
        </div>
      )}

      {expanded && (
        <DeckGrid
          id={`${headingId}-content`}
          decks={decks}
          onUntrack={onUntrack}
          untrackingDeckId={untrackingDeckId}
        />
      )}
    </section>
  );
}

/**
 * Four display groups over five statuses (`ready` and `active` share Ativos).
 * Empty groups are omitted; Aposentados starts collapsed and persists its
 * state under `ra-shelf-retired-expanded`.
 */
export function StatusGroups({
  decks,
  onUntrack,
  untrackingDeckId,
  isAllRetired,
}: IStatusGroupsProps): React.ReactElement {
  const baseId = useId();

  return (
    <div className={styles.groups}>
      {GROUP_ORDER.map((group) => {
        const groupDecks = filterByGroup(decks, group);
        if (groupDecks.length === 0) return null;
        const headingId = `${baseId}-group-${group}`;

        if (group === 'retired') {
          return (
            <RetiredGroup
              key={group}
              decks={groupDecks}
              headingId={headingId}
              onUntrack={onUntrack}
              untrackingDeckId={untrackingDeckId}
              isAllRetired={isAllRetired}
            />
          );
        }

        return (
          <section key={group} className={styles.group} aria-labelledby={headingId}>
            <GroupHead group={group} headingId={headingId} count={groupDecks.length} />
            <DeckGrid
              decks={groupDecks}
              onUntrack={onUntrack}
              untrackingDeckId={untrackingDeckId}
            />
          </section>
        );
      })}
    </div>
  );
}
