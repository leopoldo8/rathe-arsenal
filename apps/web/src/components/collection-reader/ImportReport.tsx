import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from '@tanstack/react-router';
import { ApiError } from '../../lib/api-client';
import { useCreateImportMutation, useReadImportMutation } from '../../api/collection-imports';
import { localizeApiError } from '../card-scanner/localize-api-error';
import { DEFAULT_LIBRARY_SEARCH } from '../../routes/_auth/-library.helpers';
import { recordRecentlyAddedSource } from '../library/RecentlyAddedBanner.helpers';
import {
  buildImportBody,
  countItems,
  groupOf,
  readyCards,
  readyCopies,
  type IReaderItem,
  type TItemGroup,
} from './readerState';
import { ReaderLineBody } from './ReaderLineView';
import { useReaderItems } from './useReaderItems';
import styles from './CollectionReader.module.css';

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const GROUPS: ReadonlyArray<readonly [TItemGroup, string]> = [
  ['color', 'collectionReader.groupNoColor'],
  ['similar', 'collectionReader.groupSimilar'],
  ['quantity', 'collectionReader.groupQuantity'],
  ['notFound', 'collectionReader.groupNotFound'],
];

interface IDuplicate {
  readonly label: string;
}

function duplicateOf(error: unknown): IDuplicate | null {
  if (!(error instanceof ApiError) || error.status !== 409) return null;
  try {
    const body = JSON.parse(error.message) as { code?: string; details?: { existingLabel?: string | null } };
    return body.code === 'DUPLICATE_IMPORT' ? { label: body.details?.existingLabel ?? '' } : null;
  } catch {
    return null;
  }
}

function columnNames(columns: readonly string[], language: string, t: (key: string) => string): string {
  const names = columns.map((column) => t(`collectionReader.column${column.charAt(0).toUpperCase()}${column.slice(1)}`));
  return new Intl.ListFormat(language, { style: 'long', type: 'conjunction' }).format(names);
}

function ReportGroup({ group, label, items, reader }: {
  readonly group: TItemGroup;
  readonly label: string;
  readonly items: readonly IReaderItem[];
  readonly reader: ReturnType<typeof useReaderItems>;
}): React.ReactElement | null {
  const { t } = useTranslation();
  const inGroup = items.filter((item) => groupOf(item) === group);
  if (inGroup.length === 0) return null;
  return (
    <section>
      <h3 className={styles.groupHeading}>
        <span>{label}</span>
        <span>{inGroup.length}</span>
      </h3>
      <ul className={styles.groupLines}>
        {inGroup.map((item) => (
          <li key={item.line.lineNumber} className={styles.reportLine}>
            <span className={styles.lineNumber}>{t('collectionReader.lineLabel', { line: item.line.lineNumber })}</span>
            <div className={styles.lineBody}>
              <p className={styles.original}>{item.line.originalText}</p>
              <ReaderLineBody item={item} reader={reader} showUnknown />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

interface IImportReportProps {
  readonly file: File;
  readonly onChooseAnother: () => void;
}

/** The report of a spreadsheet: what was read, the lines that wait for an answer, and one button to add the ready ones. */
export function ImportReport({ file, onChooseAnother }: IImportReportProps): React.ReactElement {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const read = useReadImportMutation();
  const create = useCreateImportMutation();
  const reader = useReaderItems(read);
  const [columns, setColumns] = useState<readonly string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<IDuplicate | null>(null);
  const { load } = reader;
  const { mutate: readFile } = read;

  useEffect(() => {
    if (file.size > MAX_FILE_BYTES) {
      setReadError(t('csvSources.fileSizeError'));
      return;
    }
    readFile(
      { file },
      {
        onSuccess: (response) => {
          setColumns(response.columns);
          load(response.lines);
          setLoaded(true);
        },
        onError: (error) => {
          setReadError(error instanceof ApiError && error.status === 413 ? t('csvSources.fileSizeError') : localizeApiError(error, t));
        },
      },
    );
  }, [file, load, readFile, t]);

  const { items } = reader;
  const counts = countItems(items);
  const unresolved = counts.read - counts.ready;

  function add(strategy?: 'separate'): void {
    if (counts.ready === 0 || create.isPending) return;
    setAddError(null);
    create.mutate(
      buildImportBody(items, {
        kind: 'csv',
        name: file.name,
        fileName: file.name,
        ...(strategy === undefined ? {} : { duplicateStrategy: strategy }),
      }),
      {
        onSuccess: (response) => {
          recordRecentlyAddedSource({ kind: 'csv', label: response.source.label, cardCount: response.source.copies });
          void navigate({ to: '/library', search: DEFAULT_LIBRARY_SEARCH });
        },
        onError: (error) => {
          const existing = duplicateOf(error);
          if (existing !== null) setDuplicate(existing);
          else setAddError(t('collectionReader.addError'));
        },
      },
    );
  }

  return (
    <div className={styles.page}>
      <Link to="/add-cards" className={styles.back}>
        <span aria-hidden="true">‹ </span>
        {t('collectionReader.back')}
      </Link>
      {readError !== null && (
        <div className={styles.panel}>
          <p role="alert" className={styles.error}>{readError}</p>
          <button type="button" className={styles.action} onClick={onChooseAnother}>
            {t('collectionReader.sheetRetry')}
          </button>
        </div>
      )}
      {readError === null && !loaded && <p className={styles.summary}>{t('collectionReader.sheetReading', { filename: file.name })}</p>}
      {loaded && (
        <>
          <section className={styles.reportCard}>
            <p className={styles.fileName}>{file.name}</p>
            <p className={styles.headline}>
              {t('collectionReader.reportReady', { count: counts.ready })} · {t('collectionReader.copiesCount', { count: readyCopies(items) })} (
              {t('collectionReader.cardsCount', { count: readyCards(items) })})
            </p>
            {columns.length > 0 && <p className={styles.note}>{t('collectionReader.columnsRead', { columns: columnNames(columns, i18n.language, t) })}</p>}
            {columns.length > 0 && !columns.includes('versão') && <p className={styles.note}>{t('collectionReader.noVersionColumn')}</p>}
            {items.flatMap((item) =>
              item.line.notes.map((note) => (
                <p key={`${item.line.lineNumber}-${note}`} className={styles.note}>
                  {t('collectionReader.noteLine', { line: item.line.lineNumber, note })}
                </p>
              )),
            )}
          </section>
          {unresolved > 0 && (
            <>
              <h2 className={styles.title}>{t('collectionReader.toResolve', { count: unresolved })}</h2>
              <div className={styles.lines}>
                {GROUPS.map(([group, key]) => (
                  <ReportGroup key={group} group={group} label={t(key)} items={items} reader={reader} />
                ))}
              </div>
            </>
          )}
          <div className={styles.footer}>
            {duplicate !== null ? (
              <>
                <p role="alert" className={styles.error}>{t('collectionReader.addDuplicate', { label: duplicate.label })}</p>
                <button type="button" className={styles.primary} disabled={create.isPending} onClick={() => add('separate')}>
                  {t('collectionReader.addAgain')}
                </button>
              </>
            ) : (
              <button type="button" className={styles.primary} disabled={counts.ready === 0 || create.isPending} onClick={() => add()}>
                {create.isPending ? t('collectionReader.adding') : t('collectionReader.addReady', { count: counts.ready })}
              </button>
            )}
            {addError !== null && <p role="alert" className={styles.error}>{addError}</p>}
            {unresolved > 0 && <p className={styles.footnote}>{t('collectionReader.addKeepNote', { count: unresolved })}</p>}
          </div>
        </>
      )}
    </div>
  );
}
