import React from 'react';
import { useTranslation } from 'react-i18next';
import type { IMissingLine } from '../../api/missing-list';
import { cardName } from '../../lib/card-name';
import { neededCopies } from './missingListModel';
import styles from './MissingSections.module.css';

interface IMissingSectionsProps {
  readonly lines: readonly IMissingLine[];
}

/** Copies the store cannot supply for a line: every copy of a card it lacks, or the shortfall of one it has some of. */
function lackedCopies(line: IMissingLine): number {
  if (line.state === 'store_lacks') return neededCopies(line);
  if (line.state === 'priced') return Math.max(0, neededCopies(line) - (line.availableCopies ?? 0));
  return 0;
}

function Thumb({ line }: { readonly line: IMissingLine }): React.ReactElement {
  return line.imageUrl === null ? (
    <span className={styles.placeholder} aria-hidden="true" />
  ) : (
    <img className={styles.thumb} src={line.imageUrl} alt="" loading="lazy" />
  );
}

/** The desktop list's two lower sections: what the store does not have, and what is not on its site. */
export function MissingSections({ lines }: IMissingSectionsProps): React.ReactElement | null {
  const { t } = useTranslation();
  const lacks = lines.filter((line) => lackedCopies(line) > 0);
  const offSite = lines.filter((line) => line.state === 'not_on_site' && neededCopies(line) > 0);
  if (lacks.length === 0 && offSite.length === 0) return null;

  return (
    <div className={styles.sections}>
      {lacks.length > 0 && (
        <section className={styles.section} aria-labelledby="missing-lacks-title">
          <h2 id="missing-lacks-title" className={styles.title}>
            {t('missingList.sectionLacks', { count: lacks.reduce((sum, line) => sum + lackedCopies(line), 0) })}
          </h2>
          <ul className={styles.list}>
            {lacks.map((line) => (
              <li key={line.cardIdentifier} className={styles.item}>
                <Thumb line={line} />
                <span className={styles.name}>{cardName(line.name, line.pitch, t)}</span>
                <span className={styles.copies}>{t('missingList.sectionCopies', { count: lackedCopies(line) })}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {offSite.length > 0 && (
        <section className={styles.section} aria-labelledby="missing-offsite-title">
          <h2 id="missing-offsite-title" className={styles.title}>
            {t('missingList.sectionOffSite', { count: offSite.reduce((sum, line) => sum + neededCopies(line), 0) })}
          </h2>
          <ul className={styles.list}>
            {offSite.map((line) => {
              const name = cardName(line.name, line.pitch, t);
              return (
                <li key={line.cardIdentifier} className={styles.item}>
                  <Thumb line={line} />
                  <span className={styles.nameBlock}>
                    <span className={styles.name}>{name}</span>
                    <span className={styles.note}>{t('missingList.notOnSite')}</span>
                  </span>
                  <span className={styles.copies}>{t('missingList.sectionCopies', { count: neededCopies(line) })}</span>
                  {line.searchUrl !== null && (
                    <a
                      className={styles.link}
                      href={line.searchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      referrerPolicy="no-referrer"
                      aria-label={t('missingList.searchThereAria', { name })}
                    >
                      {t('missingList.searchThere')}
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
