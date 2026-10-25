import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  useDeletePendingMutation,
  usePendingLinesQuery,
  useReadImportMutation,
  useResolvePendingMutation,
  type IPendingLine,
  type ILineSuggestion,
  type IReadLine,
  type TColorOption,
} from '../../api/collection-imports';
import { cardName } from '../../lib/card-name';
import { DEFAULT_LIBRARY_SEARCH } from '../../routes/_auth/-library.helpers';
import { ColorChoices } from './ReaderBlocks';
import baseStyles from './CollectionReader.module.css';
import styles from './PendingResolver.module.css';

const MAX_COPIES = 20;
const SEARCH_DELAY_MS = 350;
const MAX_SEGMENTS = 30;

interface IOpenLine {
  readonly line: IPendingLine;
  readonly label: string;
}

function cardOfRead(line: IReadLine): ILineSuggestion | null {
  const found = line.cardIdentifier !== null && line.name !== null
    ? { cardIdentifier: line.cardIdentifier, name: line.name, pitch: line.pitch, imageUrl: line.imageUrl }
    : null;
  return found ?? line.suggestion;
}

function Thumb({ card }: { readonly card: ILineSuggestion | null }): React.ReactElement {
  return card?.imageUrl ? (
    <img className={styles.thumb} src={card.imageUrl.small} alt="" loading="lazy" />
  ) : (
    <span className={styles.thumb} aria-hidden="true" />
  );
}

interface IProgressProps {
  readonly resolved: number;
  readonly total: number;
}

function Progress({ resolved, total }: IProgressProps): React.ReactElement {
  const { t } = useTranslation();
  const count = Math.min(total, MAX_SEGMENTS);
  const done = Math.round((resolved / total) * count);
  return (
    <div
      className={styles.segments}
      role="progressbar"
      aria-label={t('collectionReader.resolveProgressAria')}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={resolved}
    >
      {Array.from({ length: count }, (_unused, index) => (
        <i
          key={index}
          className={`${styles.segment} ${index < done ? styles.segmentDone : index === done ? styles.segmentCurrent : ''}`}
        />
      ))}
    </div>
  );
}

interface IStepProps {
  readonly line: IPendingLine;
  readonly failed: boolean;
  readonly busy: boolean;
  readonly onAdd: (cardIdentifier: string, quantity: number) => void;
  readonly onSkip: () => void;
  readonly onDelete: () => void;
}

/** What the line starts with: the card the API points at (a near name, or the known card of an unreadable quantity). */
function startingCard(line: IPendingLine): ILineSuggestion | null {
  return line.reason === 'not_found' ? null : line.suggestion;
}

function Step({ line, failed, busy, onAdd, onSkip, onDelete }: IStepProps): React.ReactElement {
  const { t } = useTranslation();
  const read = useReadImportMutation();
  const { mutate: readText } = read;
  const [card, setCard] = useState<ILineSuggestion | null>(() => (line.reason === 'asks_color' ? null : startingCard(line)));
  const [searching, setSearching] = useState(line.reason === 'not_found');
  const [text, setText] = useState('');
  const [noMatch, setNoMatch] = useState(false);
  const [quantity, setQuantity] = useState(() => Math.min(Math.max(line.quantityHint ?? 1, 1), MAX_COPIES));
  const typed = useRef(false);

  useEffect(() => {
    if (!searching || !typed.current || text.trim() === '') return undefined;
    const timer = setTimeout(() => {
      readText(
        { text: text.trim() },
        {
          onSuccess: (response) => {
            const found = response.lines[0] === undefined ? null : cardOfRead(response.lines[0]);
            setCard(found);
            setNoMatch(found === null);
          },
        },
      );
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [searching, text, readText]);

  const pickColor = (option: TColorOption): void => {
    if (option.kind !== 'pitch') return;
    setCard({ cardIdentifier: option.cardIdentifier, name: line.suggestion?.name ?? '', pitch: option.pitch, imageUrl: null });
  };

  const title = card === null ? null : cardName(card.name, card.pitch, t);
  const asksQuantity = line.reason === 'bad_quantity';
  const suggested = line.reason === 'suggestion' && !searching && card !== null;

  return (
    <>
      <div className={styles.card}>
        <p className={styles.tag}>{t('collectionReader.resolveLineTag', { line: line.lineNumber })}</p>
        <p className={styles.raw}>{line.originalText}</p>

        {line.reason === 'asks_color' && line.options !== null && card === null && (
          <>
            <p className={styles.prompt}>{t('collectionReader.askColor')}</p>
            <ColorChoices options={line.options} showUnknown={false} declined={false} onPick={pickColor} />
          </>
        )}

        {searching && (
          <>
            {line.reason === 'not_found' && <p className={styles.prompt}>{t('collectionReader.resolveNotFound')}</p>}
            <input
              type="search"
              className={styles.search}
              value={text}
              aria-label={t('collectionReader.resolveSearchAria')}
              onChange={(event) => {
                typed.current = true;
                setText(event.target.value);
                setNoMatch(false);
              }}
            />
            {noMatch && <p className={styles.noMatch}>{t('collectionReader.resolveNoMatch')}</p>}
          </>
        )}

        {card !== null && title !== null && (
          <div className={styles.known}>
            <Thumb card={card} />
            <div className={styles.knownText}>
              {suggested && <p className={styles.tag}>{t('collectionReader.resolveMeant')}</p>}
              <p className={styles.cardTitle}>{title}</p>
              {asksQuantity && (
                <p className={styles.note}>
                  {line.quantityHint === null && /^\s*$/.test(line.originalText.split(',')[1] ?? '')
                    ? t('collectionReader.resolveNoQuantity')
                    : t('collectionReader.resolveBadQuantity', { raw: line.originalText.split(',')[1]?.trim() ?? '' })}
                </p>
              )}
            </div>
          </div>
        )}

        <p className={styles.tag}>{t('collectionReader.resolveCopies')}</p>
        <div className={styles.stepper}>
          <button
            type="button"
            className={styles.stepperButton}
            aria-label={t('collectionReader.resolveCopiesLess')}
            disabled={quantity <= 1}
            onClick={() => setQuantity((current) => current - 1)}
          >
            −
          </button>
          <span className={styles.stepperValue} aria-live="polite">{quantity}</span>
          <button
            type="button"
            className={styles.stepperButton}
            aria-label={t('collectionReader.resolveCopiesMore')}
            disabled={quantity >= MAX_COPIES}
            onClick={() => setQuantity((current) => current + 1)}
          >
            +
          </button>
        </div>

        <button
          type="button"
          className={styles.add}
          disabled={card === null || busy}
          onClick={() => card !== null && onAdd(card.cardIdentifier, quantity)}
        >
          {card === null || title === null ? t('collectionReader.resolveAdd') : t('collectionReader.resolveAddCard', { count: quantity, card: title })}
        </button>
        {failed && <p role="alert" className={baseStyles.error}>{t('collectionReader.pendingActionError')}</p>}

        {suggested ? (
          <>
            <div className={styles.pair}>
              <button type="button" className={styles.secondary} onClick={() => { setSearching(true); setCard(null); }}>
                {t('collectionReader.resolveNotThis')}
              </button>
              <button type="button" className={styles.secondary} onClick={onSkip}>{t('collectionReader.resolveSkip')}</button>
            </div>
            <button type="button" className={styles.dangerLink} disabled={busy} onClick={onDelete}>
              {t('collectionReader.resolveDelete')}
            </button>
          </>
        ) : (
          <div className={styles.pair}>
            <button type="button" className={styles.secondary} onClick={onSkip}>{t('collectionReader.resolveSkip')}</button>
            <button type="button" className={styles.danger} disabled={busy} onClick={onDelete}>
              {t('collectionReader.resolveDelete')}
            </button>
          </div>
        )}
      </div>
      <p className={styles.note}>{t('collectionReader.resolveSkipNote')}</p>
    </>
  );
}

interface IPendingResolverProps {
  /** Opens only the lines of this import; every import with lines when absent. */
  readonly sourceId?: string | undefined;
}

export function PendingResolver({ sourceId }: IPendingResolverProps): React.ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const query = usePendingLinesQuery();
  const resolve = useResolvePendingMutation();
  const remove = useDeletePendingMutation();
  // Lines settled and lines skipped live in the page only: the API returns open lines alone.
  const [settled, setSettled] = useState<readonly number[]>([]);
  const [skipped, setSkipped] = useState<readonly number[]>([]);
  const [failed, setFailed] = useState(false);

  const open = useMemo<readonly IOpenLine[]>(() => {
    const all = (query.data?.imports ?? [])
      .filter((entry) => sourceId === undefined || entry.sourceId === sourceId)
      .flatMap((entry) => entry.lines.map((line) => ({ line, label: entry.label })))
      .filter((entry) => !settled.includes(entry.line.id));
    const fresh = all.filter((entry) => !skipped.includes(entry.line.id));
    const later = skipped.flatMap((id) => all.filter((entry) => entry.line.id === id));
    return [...fresh, ...later];
  }, [query.data, sourceId, settled, skipped]);

  const current = open[0];
  const total = settled.length + open.length;
  const wasWorking = settled.length > 0;

  useEffect(() => {
    if (query.isSuccess && wasWorking && current === undefined) {
      void navigate({ to: '/library', search: DEFAULT_LIBRARY_SEARCH });
    }
  }, [query.isSuccess, wasWorking, current, navigate]);

  const settle = (id: number): void => {
    setFailed(false);
    setSettled((previous) => [...previous, id]);
  };

  const rest = current === undefined ? [] : [
    current.label,
    ...(open.length > 1 ? [t('collectionReader.resolveAfter', { count: open.length - 1 })] : []),
    ...(settled.length > 0 ? [t('collectionReader.resolveDone', { count: settled.length })] : []),
  ];

  return (
    <div className={baseStyles.page}>
      <div className={styles.top}>
        <Link to="/library" search={DEFAULT_LIBRARY_SEARCH} className={baseStyles.back}>
          <span aria-hidden="true">‹ </span>
          {t('collectionReader.collectionBack')}
        </Link>
        <Link to="/library" search={DEFAULT_LIBRARY_SEARCH} className={styles.exit}>
          {t('collectionReader.resolveExit')}
        </Link>
      </div>
      {query.isError && <p role="alert" className={baseStyles.error}>{t('collectionReader.pendingLoadError')}</p>}
      {query.isSuccess && current === undefined && !wasWorking && <p className={baseStyles.summary}>{t('collectionReader.pendingEmpty')}</p>}
      {current !== undefined && (
        <>
          <div>
            <h1 className={styles.position}>
              {t('collectionReader.resolvePosition', { position: settled.length + 1, total })}
            </h1>
            <p className={styles.progressText}>{rest.join(' · ')}</p>
          </div>
          <Progress resolved={settled.length} total={total} />
          <Step
            key={current.line.id}
            line={current.line}
            failed={failed}
            busy={resolve.isPending || remove.isPending}
            onAdd={(cardIdentifier, quantity) =>
              resolve.mutate(
                { id: current.line.id, cardIdentifier, quantity },
                { onSuccess: () => settle(current.line.id), onError: () => setFailed(true) },
              )
            }
            onSkip={() => {
              setFailed(false);
              setSkipped((previous) => [...previous.filter((id) => id !== current.line.id), current.line.id]);
            }}
            onDelete={() =>
              remove.mutate(current.line.id, { onSuccess: () => settle(current.line.id), onError: () => setFailed(true) })
            }
          />
        </>
      )}
    </div>
  );
}
