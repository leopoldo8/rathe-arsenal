import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { AddOptionRow } from '../add-cards/AddOptionRow';
import { UnconfirmedEmailLine } from '../confirmation/UnconfirmedEmailLine';
import styles from './FirstRunChooser.module.css';

/** The first screen of a new account: the ways to put cards in, the box a beginner bought first. */
export function FirstRunChooser(): React.ReactElement {
  const { t } = useTranslation();
  return (
    <section className={styles.page} aria-labelledby="first-run-title">
      <UnconfirmedEmailLine />
      <h1 id="first-run-title" className={styles.title}>
        {t('onboarding.firstRunTitle')}
      </h1>
      <div className={styles.options}>
        <AddOptionRow to="/add-cards/product" icon="box" title={t('onboarding.firstRunProduct')} hint={t('onboarding.firstRunProductHint')} />
        <AddOptionRow to="/add-cards" icon="link" title={t('onboarding.firstRunPaste')} />
        <AddOptionRow to="/add-cards/csv" icon="upload" title={t('onboarding.firstRunCsv')} />
        <AddOptionRow to="/add-cards/scan" icon="camera" title={t('onboarding.firstRunScan')} />
      </div>
      <Link to="/home" search={{ tag: [] }} className={styles.skip}>
        {t('onboarding.firstRunSkip')}
      </Link>
    </section>
  );
}
