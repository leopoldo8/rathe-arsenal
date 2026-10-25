import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useHeroesQuery, type IHeroListItem } from '../../api/catalog';
import { supportedFormatsOf } from './newDeckFormats';
import styles from './NewDeckHeroSearch.module.css';

interface INewDeckHeroSearchProps {
  readonly query: string;
  readonly onQueryChange: (query: string) => void;
  readonly onPick: (hero: IHeroListItem) => void;
}

export function NewDeckHeroSearch({ query, onQueryChange, onPick }: INewDeckHeroSearchProps): React.ReactElement {
  const { t } = useTranslation();
  const heroes = useHeroesQuery().data?.heroes;
  const trimmed = query.trim().toLowerCase();
  const results = useMemo(
    () =>
      trimmed.length === 0
        ? []
        : (heroes ?? []).filter(
            (hero) => hero.name.toLowerCase().includes(trimmed) && supportedFormatsOf(hero.legalFormats).length > 0,
          ),
    [heroes, trimmed],
  );

  return (
    <div className={styles.search}>
      <label className={styles.field}>
        <svg className={styles.glass} viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
          <circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <span className={styles.visuallyHidden}>{t('decks.heroSearchLabel')}</span>
        <input
          type="search"
          className={styles.input}
          value={query}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => onQueryChange(event.currentTarget.value)}
        />
      </label>
      {trimmed.length > 0 && results.length === 0 && <p className={styles.note}>{t('decks.heroSearchNoResults')}</p>}
      {results.length > 0 && (
        <ul className={styles.results}>
          {results.map((hero) => (
            <li key={hero.cardIdentifier}>
              <button type="button" className={styles.result} onClick={() => onPick(hero)}>
                {hero.imageUrl !== null && <img className={styles.art} src={hero.imageUrl.small} alt="" />}
                <span className={styles.resultText}>
                  <span className={styles.name}>{hero.young ? t('decks.heroYoungName', { name: hero.name }) : hero.name}</span>
                  <span className={styles.chips}>
                    {supportedFormatsOf(hero.legalFormats).map((format) => (
                      <span key={format} className={styles.chip}>
                        {format}
                      </span>
                    ))}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {results.some((hero) => hero.young) && <p className={styles.note}>{t('decks.heroYoungNote')}</p>}
    </div>
  );
}
