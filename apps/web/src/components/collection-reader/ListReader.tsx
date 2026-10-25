import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from '@tanstack/react-router';
import { useCreateImportMutation, useReadImportMutation } from '../../api/collection-imports';
import { cardName } from '../../lib/card-name';
import { DEFAULT_LIBRARY_SEARCH } from '../../routes/_auth/-library.helpers';
import { recordRecentlyAddedSource } from '../library/RecentlyAddedBanner.helpers';
import { buildImportBody, cardOf, countItems, groupOf, isReady, readyCopies, type IReaderItem } from './readerState';
import { lineMark, readyTitle } from './lineParts';
import { ReaderLineBody } from './ReaderLineView';
import { useReaderItems, type IReaderItems } from './useReaderItems';
import styles from './CollectionReader.module.css';

type TVersionChoice = 'unknown' | 'plain' | 'perLine';

const READ_DELAY_MS = 300;

function SummaryLine({ items }: { readonly items: readonly IReaderItem[] }): React.ReactElement {
  const { t } = useTranslation();
  const counts = countItems(items);
  const parts = [
    t('collectionReader.summaryReady', { count: counts.ready }),
    counts.needsColor > 0 ? t('collectionReader.summaryNeedsColor', { count: counts.needsColor }) : null,
    counts.similar > 0 ? t('collectionReader.summarySimilar', { count: counts.similar }) : null,
    counts.quantity > 0 ? t('collectionReader.summaryQuantity', { count: counts.quantity }) : null,
    counts.notFound > 0 ? t('collectionReader.summaryNotFound', { count: counts.notFound }) : null,
  ].filter((part): part is string => part !== null);
  return (
    <p className={styles.summary}>
      {t('collectionReader.summaryLead', { count: counts.read })} {parts.join(' · ')}
    </p>
  );
}

function ListLine({ item, reader }: { readonly item: IReaderItem; readonly reader: IReaderItems }): React.ReactElement {
  const { t } = useTranslation();
  const { line } = item;
  const mark = lineMark(item);
  const ready = isReady(item);
  const accepted = ready && item.settled !== null && line.outcome === 'suggestion';
  const card = cardOf(item);
  const asksColor = groupOf(item) === 'color';
  const title = asksColor
    ? `${item.quantity ?? ''} ${line.name ?? ''} · ${t('collectionReader.askColor')}`.trim()
    : ready
      ? readyTitle(item, t)
      : null;
  return (
    <li className={styles.line}>
      <span className={styles.lineNumber}>{line.lineNumber}</span>
      <span className={`${styles.mark} ${mark.className}`} role="img" aria-label={t(mark.labelKey)}>
        {mark.glyph}
      </span>
      <div className={styles.lineBody}>
        {title !== null && <p className={styles.lineTitle}>{title}</p>}
        {ready && line.notes.map((note) => <p key={note} className={styles.note}>{note}</p>)}
        {ready && line.versionNote !== null && <p className={styles.versionNote}>{line.versionNote}</p>}
        {accepted && card !== null && (
          <p className={styles.note}>
            {t('collectionReader.accepted', { card: cardName(card.name, card.pitch, t) })} ·{' '}
            <button type="button" className={styles.linkAction} onClick={() => reader.undo(line.lineNumber)}>
              {t('collectionReader.undo')}
            </button>
          </p>
        )}
        {!ready && <ReaderLineBody item={item} reader={reader} showUnknown={false} />}
        <p className={styles.original}>{line.originalText}</p>
      </div>
    </li>
  );
}

/** The pasted list: read line by line as the player types, answered on the spot, added as one import. */
export function ListReader(): React.ReactElement {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const read = useReadImportMutation();
  const create = useCreateImportMutation();
  const reader = useReaderItems(read);
  const [text, setText] = useState('');
  const [version, setVersion] = useState<TVersionChoice>('unknown');
  const [failed, setFailed] = useState<'read' | 'add' | null>(null);
  const latest = useRef(0);
  const { load } = reader;
  const { mutate: readText } = read;

  useEffect(() => {
    const turn = latest.current + 1;
    latest.current = turn;
    if (text.trim() === '') {
      load([]);
      return undefined;
    }
    const timer = setTimeout(() => {
      readText(
        { text },
        {
          onSuccess: (response) => {
            if (latest.current !== turn) return;
            setFailed(null);
            load(response.lines);
          },
          onError: () => {
            if (latest.current === turn) setFailed('read');
          },
        },
      );
    }, READ_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text, load, readText]);

  const { items } = reader;
  const counts = useMemo(() => countItems(items), [items]);
  const copies = readyCopies(items);
  const kept = items.length - counts.ready;

  function add(): void {
    if (counts.ready === 0 || create.isPending) return;
    const name = t('collectionReader.listNamePrefix', {
      date: new Intl.DateTimeFormat(i18n.language, { day: '2-digit', month: '2-digit' }).format(new Date()),
    });
    create.mutate(
      buildImportBody(items, {
        kind: 'paste',
        name,
        ...(version === 'plain' ? { defaultVersion: { finish: 'none' as const, condition: 'NM' as const } } : {}),
      }),
      {
        onSuccess: (response) => {
          recordRecentlyAddedSource({ kind: 'csv', label: response.source.label, cardCount: response.source.copies });
          void navigate({ to: '/library', search: DEFAULT_LIBRARY_SEARCH });
        },
        onError: () => setFailed('add'),
      },
    );
  }

  return (
    <div className={styles.page}>
      <Link to="/add-cards" className={styles.back}>
        <span aria-hidden="true">‹ </span>
        {t('collectionReader.back')}
      </Link>
      <h1 className={styles.title}>{t('collectionReader.listTitle')}</h1>
      <textarea
        className={styles.text}
        value={text}
        placeholder={t('collectionReader.listPlaceholder')}
        aria-label={t('collectionReader.listTextAria')}
        onChange={(event) => setText(event.target.value)}
      />
      <section className={styles.panel} aria-labelledby="reader-version">
        <h2 id="reader-version" className={styles.panelTitle}>
          {t('collectionReader.versionHeading')}
        </h2>
        <ul className={styles.chips}>
          {(
            [
              ['unknown', t('copyVersions.unknown')],
              ['plain', t('collectionReader.versionPlainNm')],
              ['perLine', t('collectionReader.versionPerLine')],
            ] as const
          ).map(([choice, label]) => (
            <li key={choice}>
              <button type="button" className={styles.chip} aria-pressed={version === choice} onClick={() => setVersion(choice)}>
                {label}
              </button>
            </li>
          ))}
        </ul>
      </section>
      {read.isPending && items.length === 0 && <p className={styles.summary}>{t('collectionReader.reading')}</p>}
      {failed === 'read' && <p role="alert" className={styles.error}>{t('collectionReader.readError')}</p>}
      {items.length > 0 && (
        <>
          <SummaryLine items={items} />
          <ol className={styles.lines}>
            {items.map((item) => (
              <ListLine key={`${item.line.lineNumber}-${item.line.originalText}`} item={item} reader={reader} />
            ))}
          </ol>
          <div className={styles.footer}>
            <button type="button" className={styles.primary} disabled={counts.ready === 0 || create.isPending} onClick={add}>
              {create.isPending
                ? t('collectionReader.adding')
                : `${t('collectionReader.addReady', { count: counts.ready })} (${t('collectionReader.copiesCount', { count: copies })})`}
            </button>
            {failed === 'add' && <p role="alert" className={styles.error}>{t('collectionReader.addError')}</p>}
            {kept > 0 && <p className={styles.footnote}>{t('collectionReader.addKeepNote', { count: kept })}</p>}
          </div>
        </>
      )}
    </div>
  );
}
