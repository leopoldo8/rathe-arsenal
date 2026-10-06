import React, { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Dialog from '@radix-ui/react-dialog';
import type { TFunction } from 'i18next';
import {
  ALTERNATIVES_MIN_QUERY_LENGTH,
  useAlternativesQuery,
  usePickReplacement,
  type IAlternativeCard,
  type IAlternativeGroup,
  type IAlternativesTarget,
  type TAlternativeGroup,
} from '../../api/replacements';
import { formatSwapRationale } from '../../i18n/format-reasons';
import { formatBrl } from '../../utils/format-brl';
import { localizeApiError } from '../card-scanner/localize-api-error';
import { CardArt } from '../card-art/CardArt';
import styles from './AlternativesSheet.module.css';

const SEARCH_DEBOUNCE_MS = 250;

const GROUP_LABEL_KEY: Readonly<Record<TAlternativeGroup, string>> = {
  very_close: 'alternatives.groupVeryClose',
  close: 'alternatives.groupClose',
  other_pitch: 'alternatives.groupOtherPitch',
  generic: 'alternatives.groupGeneric',
  search: 'alternatives.groupSearch',
};

const PITCH_LABEL_KEY: Readonly<Record<number, string>> = {
  1: 'library.pitchRedLabel',
  2: 'library.pitchYellowLabel',
  3: 'library.pitchBlueLabel',
};

const PITCH_CLASS: Readonly<Record<number, string | undefined>> = {
  1: styles.pitchRed,
  2: styles.pitchYellow,
  3: styles.pitchBlue,
};

const RELAXED_KEY = {
  pitch: 'alternatives.relaxedPitch',
  class: 'alternatives.relaxedClass',
} as const;

interface IAlternativesSheetProps {
  readonly deckId: number;
  readonly target: IAlternativesTarget;
  readonly onClose: () => void;
}

function toPitch(pitch: number | null): 1 | 2 | 3 | null {
  return pitch === 1 || pitch === 2 || pitch === 3 ? pitch : null;
}

function describeRationale(card: IAlternativeCard, t: TFunction): string {
  const sentence = formatSwapRationale(card.rationale, '', t);
  const relaxed = card.rationale.relaxed;
  return relaxed === null ? sentence : `${sentence} ${t(RELAXED_KEY[relaxed])}`;
}

interface ICardOptionProps {
  readonly card: IAlternativeCard;
  readonly needed: number;
  readonly disabled: boolean;
  readonly onPick: () => void;
}

function CardOption({ card, needed, disabled, onPick }: ICardOptionProps): React.ReactElement {
  const { t } = useTranslation();
  const isOwned = card.freeCopies >= needed;

  return (
    <li className={styles.option} data-testid="alternative-card" data-card={card.cardIdentifier}>
      <button
        type="button"
        className={styles.pick}
        disabled={disabled}
        aria-label={t('alternatives.pickAria', { name: card.name })}
        onClick={onPick}
      >
        <span className={styles.art}>
          <CardArt
            name={card.name}
            pitch={toPitch(card.pitch)}
            cost={null}
            type="Action"
            missing={false}
            size="xs"
            imageUrl={card.imageUrl}
          />
        </span>
        <span className={styles.text}>
          <span className={styles.name}>
            {card.pitch !== null && PITCH_CLASS[card.pitch] !== undefined && (
              <span
                className={`${styles.pitchDot} ${PITCH_CLASS[card.pitch]}`}
                role="img"
                aria-label={t('decks.pitchAria', { pitch: t(PITCH_LABEL_KEY[card.pitch]!) })}
                data-pitch={card.pitch}
              />
            )}
            {card.name}
          </span>
          <span className={styles.rationale} data-testid="alternative-rationale">
            {describeRationale(card, t)}
          </span>
        </span>
        <span className={isOwned ? styles.owned : styles.free} data-testid="alternative-ownership">
          {isOwned ? t('alternatives.owned') : t('alternatives.free', { count: card.freeCopies })}
        </span>
      </button>
      {!isOwned &&
        (card.priceCents !== null && card.productUrl !== null ? (
          <a
            href={card.productUrl}
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
            className={styles.price}
            aria-label={`${t('alternatives.buyAria', { name: card.name })} ${formatBrl(card.priceCents)}`}
          >
            {formatBrl(card.priceCents)}
          </a>
        ) : (
          <span className={styles.stock} data-testid="alternative-out-of-stock">
            {t('alternatives.outOfStock')}
          </span>
        ))}
    </li>
  );
}

export function AlternativesSheet({ deckId, target, onClose }: IAlternativesSheetProps): React.ReactElement {
  const { t } = useTranslation();
  const inputId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [debounced, setDebounced] = useState('');
  const [pickError, setPickError] = useState<string | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(text.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [text]);

  const query = debounced.length >= ALTERNATIVES_MIN_QUERY_LENGTH ? debounced : undefined;
  const alternatives = useAlternativesQuery(deckId, target, query);
  const pick = usePickReplacement(deckId);

  const groups: readonly IAlternativeGroup[] = alternatives.data?.groups ?? [];
  const needed = alternatives.data?.needed ?? 0;
  const isEmpty = alternatives.isSuccess && groups.length === 0;

  useEffect(() => {
    if (isEmpty) searchRef.current?.focus();
  }, [isEmpty]);

  function handlePick(card: IAlternativeCard, group: TAlternativeGroup): void {
    setPickError(null);
    pick.mutate(
      {
        originalCardIdentifier: target.cardIdentifier,
        slot: target.slot,
        replacementCardIdentifier: card.cardIdentifier,
        pickedFrom: group,
      },
      {
        onSuccess: onClose,
        onError: (error) => setPickError(localizeApiError(error, t)),
      },
    );
  }

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.sheet} aria-describedby={undefined} data-testid="alternatives-sheet">
          <div className={styles.header}>
            <Dialog.Title className={styles.title}>{t('alternatives.title', { name: target.name })}</Dialog.Title>
            <Dialog.Close className={styles.close}>{t('alternatives.close')}</Dialog.Close>
          </div>
          {alternatives.isSuccess && (
            <p className={styles.needed} data-testid="alternatives-needed">
              {t('alternatives.needed', { count: needed })}
            </p>
          )}

          <label className={styles.searchLabel} htmlFor={inputId}>
            {t('alternatives.searchLabel')}
          </label>
          <input
            id={inputId}
            ref={searchRef}
            type="search"
            autoComplete="off"
            spellCheck={false}
            className={styles.searchInput}
            placeholder={t('alternatives.searchPlaceholder')}
            value={text}
            onChange={(event) => setText(event.currentTarget.value)}
          />

          {pickError !== null && (
            <p role="alert" className={styles.error} data-testid="alternatives-pick-error">
              {pickError}
            </p>
          )}

          {alternatives.isPending && (
            <p role="status" className={styles.hint} data-testid="alternatives-loading">
              {t('alternatives.loading')}
            </p>
          )}

          {alternatives.isError && (
            <div role="alert" className={styles.errorRow} data-testid="alternatives-error">
              <p className={styles.error}>{localizeApiError(alternatives.error, t)}</p>
              <button type="button" className={styles.retry} onClick={() => void alternatives.refetch()}>
                {t('alternatives.retry')}
              </button>
            </div>
          )}

          {isEmpty && (
            <p className={styles.hint} data-testid="alternatives-empty">
              {query === undefined ? t('alternatives.empty') : t('alternatives.searchEmpty')}
            </p>
          )}

          {groups.map((group) => (
            <section key={group.group} className={styles.group} data-testid={`alternatives-group-${group.group}`}>
              <h3 className={styles.groupTitle}>{t(GROUP_LABEL_KEY[group.group])}</h3>
              <ul className={styles.list} aria-label={t('alternatives.listAria')}>
                {group.cards.map((card) => (
                  <CardOption
                    key={card.cardIdentifier}
                    card={card}
                    needed={needed}
                    disabled={pick.isPending}
                    onPick={() => handlePick(card, group.group)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
