import React, { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import type { IHeroListItem } from '../../api/catalog';
import { ImportFabraryCard } from '../../components/decks-new/ImportFabraryCard';
import { NewDeckFormatStep } from '../../components/decks-new/NewDeckFormatStep';
import { NewDeckHeroSearch } from '../../components/decks-new/NewDeckHeroSearch';
import { NewDeckOptionIcon, type TNewDeckOptionIcon } from '../../components/decks-new/NewDeckOptionIcon';
import optionStyles from '../../components/decks-new/NewDeckOptions.module.css';
import styles from './decks.new.module.css';

export const Route = createFileRoute('/_auth/decks/new')({
  component: DecksNewPage,
});

export { DecksNewPage };

type TOpenRow = 'fabrary' | 'scratch' | null;

interface IOptionHeadProps {
  readonly icon: TNewDeckOptionIcon;
  readonly title: string;
}

function OptionHead({ icon, title }: IOptionHeadProps): React.ReactElement {
  return (
    <>
      <NewDeckOptionIcon name={icon} />
      <span className={optionStyles.title}>{title}</span>
    </>
  );
}

function DecksNewPage(): React.ReactElement {
  const { t } = useTranslation();
  const [openRow, setOpenRow] = useState<TOpenRow>(null);
  const [heroQuery, setHeroQuery] = useState('');
  const [pickedHero, setPickedHero] = useState<IHeroListItem | null>(null);

  if (pickedHero !== null) {
    return (
      <div className={styles.page}>
        <NewDeckFormatStep hero={pickedHero} onBack={() => setPickedHero(null)} />
      </div>
    );
  }

  const toggle = (row: Exclude<TOpenRow, null>) => () => setOpenRow((current) => (current === row ? null : row));

  return (
    <div className={styles.page}>
      <header className={styles.subviewHeader}>
        <Link to="/home" search={{ tag: [] }} className={styles.back} aria-label={t('decks.backToDecksAria')}>
          {t('decks.backToDecksLabel')}
        </Link>
        <h1 className={styles.title}>{t('decks.addNewDeck')}</h1>
      </header>

      <div className={styles.options}>
        <Link to="/add-cards/product" className={optionStyles.option}>
          <OptionHead icon="box" title={t('decks.newDeckBuyReady')} />
          <span className={optionStyles.chevron} aria-hidden="true">
            ›
          </span>
        </Link>

        <section className={optionStyles.group}>
          <button type="button" className={optionStyles.option} aria-expanded={openRow === 'fabrary'} onClick={toggle('fabrary')}>
            <OptionHead icon="link" title={t('decks.newDeckFabraryLink')} />
            <span className={optionStyles.chevron} aria-hidden="true">
              ›
            </span>
          </button>
          {openRow === 'fabrary' && <ImportFabraryCard />}
        </section>

        <section className={optionStyles.group} data-open={openRow === 'scratch'}>
          <button type="button" className={optionStyles.option} aria-expanded={openRow === 'scratch'} onClick={toggle('scratch')}>
            <OptionHead icon="type" title={t('decks.startFromScratch')} />
          </button>
          {openRow === 'scratch' && (
            <NewDeckHeroSearch query={heroQuery} onQueryChange={setHeroQuery} onPick={setPickedHero} />
          )}
        </section>
      </div>
    </div>
  );
}
