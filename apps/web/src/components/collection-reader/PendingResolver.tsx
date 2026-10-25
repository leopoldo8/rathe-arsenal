import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import {
  useDeletePendingMutation,
  usePendingLinesQuery,
  useReadImportMutation,
  useResolvePendingMutation,
  type IPendingLine,
} from '../../api/collection-imports';
import { DEFAULT_LIBRARY_SEARCH } from '../../routes/_auth/-library.helpers';
import {
  acceptSuggestion,
  cardOf,
  isReady,
  pickColor,
  replaceLine,
  setQuantity,
  toItem,
  undoSettled,
  type IReaderItem,
} from './readerState';
import { ReaderLineBody } from './ReaderLineView';
import type { IReaderItems } from './useReaderItems';
import styles from './CollectionReader.module.css';

function itemOf(line: IPendingLine): IReaderItem {
  const known = line.reason === 'bad_quantity' ? line.suggestion : null;
  return toItem({
    lineNumber: line.lineNumber,
    originalText: line.originalText,
    outcome: line.reason,
    cardIdentifier: known?.cardIdentifier ?? null,
    name: known?.name ?? line.suggestion?.name ?? null,
    pitch: known?.pitch ?? null,
    imageUrl: known?.imageUrl ?? null,
    quantity: line.reason === 'bad_quantity' ? null : line.quantityHint,
    quantityRaw: line.reason === 'bad_quantity' ? line.originalText : null,
    suggestedQuantity: line.quantityHint,
    options: line.options,
    suggestion: line.suggestion,
    version: { printingCode: '', edition: '', finish: '', condition: '' },
    versionNote: null,
    notes: [],
  });
}

/** The same answers as the report, over a single kept line: once the line is ready it is added to its import. */
function PendingLineRow({ line }: { readonly line: IPendingLine }): React.ReactElement {
  const { t } = useTranslation();
  const read = useReadImportMutation();
  const resolve = useResolvePendingMutation();
  const remove = useDeletePendingMutation();
  const [item, setItem] = useState<IReaderItem>(() => itemOf(line));
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  const { mutate: resolveLine } = resolve;
  const submitted = useRef(false);
  const card = cardOf(item);

  useEffect(() => {
    if (submitted.current || !isReady(item) || card === null || item.quantity === null) return;
    submitted.current = true;
    resolveLine(
      { id: line.id, cardIdentifier: card.cardIdentifier, quantity: item.quantity },
      {
        onError: () => {
          submitted.current = false;
          setFailed(true);
        },
      },
    );
  }, [item, card, line.id, resolveLine]);

  const lineNumber = line.lineNumber;
  const reader: IReaderItems = {
    items: [item],
    searchingLine: searching ? lineNumber : null,
    load: () => undefined,
    accept: () => setItem((current) => acceptSuggestion([current], lineNumber)[0]!),
    undo: () => setItem((current) => undoSettled([current], lineNumber)[0]!),
    pick: (_line, option) => setItem((current) => pickColor([current], lineNumber, option)[0]!),
    useQuantity: (_line, quantity) => setItem((current) => setQuantity([current], lineNumber, quantity)[0]!),
    search: (_line, text) => {
      setSearching(true);
      read.mutate(
        { text },
        {
          onSuccess: (response) => {
            const [found] = response.lines;
            if (found !== undefined) setItem((current) => replaceLine([current], lineNumber, found)[0]!);
          },
          onSettled: () => setSearching(false),
        },
      );
    },
  };

  return (
    <li className={styles.reportLine}>
      <span className={styles.lineNumber}>{t('collectionReader.lineLabel', { line: lineNumber })}</span>
      <div className={styles.lineBody}>
        <p className={styles.original}>{line.originalText}</p>
        <ReaderLineBody item={item} reader={reader} showUnknown={false} />
        {failed && <p role="alert" className={styles.error}>{t('collectionReader.pendingActionError')}</p>}
        <button
          type="button"
          className={styles.linkAction}
          aria-label={t('collectionReader.pendingDeleteAria', { line: lineNumber })}
          disabled={remove.isPending}
          onClick={() => remove.mutate(line.id, { onError: () => setFailed(true) })}
        >
          {t('collectionReader.pendingDelete')}
        </button>
      </div>
    </li>
  );
}

interface IPendingResolverProps {
  /** Opens only the lines of this import; every import with lines when absent. */
  readonly sourceId?: string | undefined;
}

export function PendingResolver({ sourceId }: IPendingResolverProps): React.ReactElement {
  const { t } = useTranslation();
  const query = usePendingLinesQuery();
  const imports = useMemo(
    () => (query.data?.imports ?? []).filter((entry) => entry.lines.length > 0 && (sourceId === undefined || entry.sourceId === sourceId)),
    [query.data, sourceId],
  );
  return (
    <div className={styles.page}>
      <Link to="/library" search={DEFAULT_LIBRARY_SEARCH} className={styles.back}>
        <span aria-hidden="true">‹ </span>
        {t('collectionReader.collectionBack')}
      </Link>
      <h1 className={styles.title}>{t('collectionReader.pendingTitle')}</h1>
      {query.isError && <p role="alert" className={styles.error}>{t('collectionReader.pendingLoadError')}</p>}
      {query.isSuccess && imports.length === 0 && <p className={styles.summary}>{t('collectionReader.pendingEmpty')}</p>}
      {imports.map((entry) => (
        <section key={entry.sourceId}>
          <h2 className={styles.groupHeading}>
            <span>{entry.label}</span>
            <span>{entry.lines.length}</span>
          </h2>
          <ul className={styles.groupLines}>
            {entry.lines.map((line) => (
              <PendingLineRow key={line.id} line={line} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
