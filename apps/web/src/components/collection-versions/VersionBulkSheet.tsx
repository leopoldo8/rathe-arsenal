import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import {
  useMarkSourceVersionsMutation,
  useSourceCopiesQuery,
  type ISourceCopy,
  type TCondition,
  type TEdition,
  type TFinish,
} from '../../api/collection-versions';
import { useLibraryQuery } from '../../api/library';
import { cardName } from '../../lib/card-name';
import { CardVersionsSheet } from './CardVersionsSheet';
import { EDITION_OPTIONS, describeVersion, editionLabel, finishLabel, isUnversioned } from './copy-version-labels';
import styles from './CopyVersions.module.css';

/** The three groups of "Marcar de uma vez": a chosen value, or `''` for "Não sei", or nothing yet. */
const BULK_FINISHES: readonly TFinish[] = ['none', 'rainbow', 'cold'];
const BULK_CONDITIONS: readonly TCondition[] = ['NM', 'LP', 'MP', 'HP'];

interface IVersionBulkSheetProps {
  readonly sourceId: string;
  readonly label: string;
}

export function VersionBulkSheet({ sourceId, label }: IVersionBulkSheetProps): React.ReactElement {
  const { t } = useTranslation();
  const copiesQuery = useSourceCopiesQuery(sourceId);
  const markMutation = useMarkSourceVersionsMutation();
  const libraryQuery = useLibraryQuery();
  const [edition, setEdition] = useState<TEdition | '' | null>(null);
  const [finish, setFinish] = useState<TFinish | '' | null>(null);
  const [condition, setCondition] = useState<TCondition | '' | null>(null);
  const [skipped, setSkipped] = useState<readonly string[] | null>(null);
  const [changing, setChanging] = useState<ISourceCopy | null>(null);

  const copies = copiesQuery.data;
  const marking = {
    ...(edition ? { edition } : {}),
    ...(finish ? { finish } : {}),
    ...(condition ? { condition } : {}),
  };
  const hasMarking = Object.keys(marking).length > 0;

  function apply(): void {
    if (!hasMarking || markMutation.isPending) return;
    markMutation.mutate(
      { sourceId, ...marking },
      { onSuccess: (result) => setSkipped(result.skipped) },
    );
  }

  const skippedNames = (skipped ?? []).map((cardIdentifier) => {
    const item = copies?.items.find((candidate) => candidate.cardIdentifier === cardIdentifier);
    return item ? cardName(item.name, item.pitch, t) : cardIdentifier;
  });
  const libraryCard = changing
    ? libraryQuery.data?.cards.find((card) => card.cardIdentifier === changing.cardIdentifier)
    : undefined;

  return (
    <div className={styles.page}>
      <Link to="/library-csv-sources" className={styles.back}>
        <span aria-hidden="true">‹ </span>
        {t('copyVersions.bulkBack')}
      </Link>
      <h1 className={styles.title}>{t('copyVersions.bulkTitle')}</h1>
      {copiesQuery.isError && <p role="alert" className={styles.error}>{t('copyVersions.bulkLoadError')}</p>}
      {copies && (
        <>
          <p className={styles.subtitle}>
            {t('copyVersions.bulkSubtitle', { label, copies: t('copyVersions.copiesCount', { count: copies.copies }) })}
          </p>
          <section className={styles.panel} aria-labelledby="bulk-mark-title">
            <h2 className={styles.panelTitle} id="bulk-mark-title">
              {t('copyVersions.bulkMarkAll')}
            </h2>
            <BulkGroup
              label={t('copyVersions.editionLabel')}
              explain={t('copyVersions.editionExplain')}
              options={EDITION_OPTIONS.map((option) => ({ value: option, text: editionLabel(option, t) }))}
              unknownText={t('copyVersions.unknown')}
              value={edition}
              onPick={setEdition}
            />
            <BulkGroup
              label={t('copyVersions.foilLabel')}
              explain={t('copyVersions.foilExplain')}
              options={BULK_FINISHES.map((option) => ({ value: option, text: finishLabel(option, t) }))}
              unknownText={t('copyVersions.unknown')}
              value={finish}
              onPick={setFinish}
            />
            <BulkGroup
              label={t('copyVersions.conditionLabel')}
              explain={t('copyVersions.conditionExplain')}
              options={BULK_CONDITIONS.map((option) => ({ value: option, text: option }))}
              unknownText={t('copyVersions.unknown')}
              value={condition}
              onPick={setCondition}
            />
            <button type="button" className={styles.primary} disabled={!hasMarking || markMutation.isPending} onClick={apply}>
              {markMutation.isPending
                ? t('copyVersions.bulkApplying')
                : t('copyVersions.bulkApply', { count: copies.withoutVersion })}
            </button>
            <p className={styles.note}>{t('copyVersions.bulkApplyNote')}</p>
            {markMutation.isError && <p role="alert" className={styles.error}>{t('copyVersions.bulkError')}</p>}
          </section>
          {skipped !== null && skipped.length > 0 && (
            <section className={styles.panel} aria-label={t('copyVersions.bulkSkippedTitle')}>
              <p className={styles.groupLabel}>{t('copyVersions.bulkSkippedTitle')}</p>
              <ul className={styles.groups}>
                {skippedNames.map((skippedName) => (
                  <li key={skippedName}>{skippedName}</li>
                ))}
              </ul>
            </section>
          )}
          <h2 className={styles.eyebrow}>{t('copyVersions.bulkPreview')}</h2>
          {copies.items.length === 0 ? (
            <p className={styles.note}>{t('copyVersions.bulkEmpty')}</p>
          ) : (
            <ul className={styles.previewList}>
              {copies.items.map((item) => {
                const itemName = cardName(item.name, item.pitch, t);
                const unversioned = isUnversioned(item);
                const shown = unversioned && hasMarking ? describeVersion(marking, t) : describeVersion(item, t);
                return (
                  <li key={`${item.cardIdentifier}|${item.printingCode}|${item.edition}|${item.finish}|${item.condition}`} className={styles.previewRow}>
                    <span>
                      <span className={styles.previewName}>{`${item.quantity} ${itemName}`}</span>
                      <span className={styles.previewVersion}>{shown || t('copyVersions.noVersion')}</span>
                    </span>
                    <button
                      type="button"
                      className={styles.change}
                      aria-label={t('copyVersions.bulkChangeAria', { name: itemName })}
                      onClick={() => setChanging(item)}
                    >
                      {t('copyVersions.bulkChange')}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
      {changing && (
        <CardVersionsSheet
          open
          onClose={() => setChanging(null)}
          card={
            libraryCard ?? {
              cardIdentifier: changing.cardIdentifier,
              name: changing.name,
              pitch: changing.pitch,
              imageUrl: null,
              ownedQuantity: changing.quantity,
              contributions: [
                {
                  sourceId,
                  sourceLabel: label,
                  kind: 'csv',
                  quantity: changing.quantity,
                  printingCode: changing.printingCode,
                  edition: changing.edition,
                  finish: changing.finish,
                  condition: changing.condition,
                },
              ],
            }
          }
        />
      )}
    </div>
  );
}

interface IBulkGroupProps<T extends string> {
  readonly label: string;
  readonly explain: string;
  readonly options: readonly { readonly value: T; readonly text: string }[];
  readonly unknownText: string;
  readonly value: T | '' | null;
  readonly onPick: (value: T | '' | null) => void;
}

function BulkGroup<T extends string>({ label, explain, options, unknownText, value, onPick }: IBulkGroupProps<T>): React.ReactElement {
  const choices: readonly { readonly value: T | ''; readonly text: string }[] = [...options, { value: '', text: unknownText }];
  return (
    <div>
      <p className={styles.groupLabel}>{label}</p>
      <ul className={styles.chips}>
        {choices.map((choice) => (
          <li key={choice.value || 'unknown'}>
            <button
              type="button"
              className={styles.chip}
              aria-pressed={value === choice.value}
              onClick={() => onPick(value === choice.value ? null : choice.value)}
            >
              {choice.text}
            </button>
          </li>
        ))}
      </ul>
      <p className={styles.explain}>{explain}</p>
    </div>
  );
}
