import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ITextListGroup } from './deckListModel';
import type { TListSectionId } from './deckListCards';
import styles from './DeckTextList.module.css';

const HEADING_KEY: Readonly<Record<TListSectionId, string>> = {
  hero: 'deckDetail.listGroupHero',
  weapon: 'deckDetail.listGroupWeapon',
  equipment: 'deckDetail.listGroupEquipment',
  deck: 'deckDetail.listGroupDeck',
  inventory: 'deckDetail.listGroupInventory',
};

/** The "Lista" view: the deck as text, one line per card, grouped as the copied list is. */
export function DeckTextList({ groups }: { readonly groups: readonly ITextListGroup[] }): React.ReactElement {
  const { t } = useTranslation();
  return (
    <div className={styles.list} data-testid="deck-text-list">
      {groups.map((group) => (
        <section key={group.id} className={styles.group} data-testid={`deck-text-group-${group.id}`}>
          <h3 className={styles.heading}>
            {t(HEADING_KEY[group.id])}
            <span className={styles.total}>{group.total}</span>
          </h3>
          {group.id === 'inventory' && <p className={styles.plain}>{t('deckDetail.inventoryPlain')}</p>}
          <ul className={styles.lines}>
            {group.lines.map((line) => (
              <li key={line.key} className={styles.line}>
                <span>{line.text}</span>
                {line.problem !== null && <span className={styles.problem}> · {line.problem}</span>}
                {line.missing !== null && <span className={styles.missing}> · {line.missing}</span>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
