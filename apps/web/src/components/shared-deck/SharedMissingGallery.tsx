import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ISharedCard, ISharedDeckResponse } from '../../api/shared-decks';
import { cardName } from '../../lib/card-name';
import { formatBrl } from '../../utils/format-brl';
import { useSpareQuery } from '../../api/spare';
import { SpareRuleSheet } from '../spare/SpareRuleSheet';
import { OfferButton } from './OfferButton';
import { EMPTY_SELECTION, giveRowKey, offerItems, setRowCopies, toggleRow, totalCopies, type TOfferSelection } from './offerSelection';
import { giveRows, inventorySplit, storeRows, type IGiveRow } from './sharedMissingModel';
import styles from './SharedMissingGallery.module.css';

const PITCH_CLASS: Readonly<Record<number, string>> = {
  1: styles.pitchRed ?? '',
  2: styles.pitchYellow ?? '',
  3: styles.pitchBlue ?? '',
};

type TTranslate = ReturnType<typeof useTranslation>['t'];

function CardThumb({ card, label }: { readonly card: ISharedCard; readonly label: string }): React.ReactElement {
  const src = card.imageUrl?.small ?? null;
  return src === null ? (
    <span className={styles.thumbPlaceholder} role="img" aria-label={label} />
  ) : (
    <img className={styles.thumb} src={src} alt={label} loading="lazy" />
  );
}

function NameLine({ card, label }: { readonly card: ISharedCard; readonly label: string }): React.ReactElement {
  return (
    <span className={styles.nameLine}>
      {card.pitch !== null && <span className={`${styles.pitchDot} ${PITCH_CLASS[card.pitch] ?? ''}`} aria-hidden="true" />}
      <span className={styles.name}>{label}</span>
    </span>
  );
}

function copiesText(row: IGiveRow, t: TTranslate): string {
  const copies = t('sharing.missingPage.copies', { count: row.copies });
  const split = inventorySplit(row.card, row.copies);
  return split === null ? copies : `${copies} · ${t('sharing.missingPage.split', { deck: split.deck, inventory: split.inventory })}`;
}

interface IGiveRowProps {
  readonly row: IGiveRow;
  readonly askRule: boolean;
  /** Whether the visitor can tick this card (everyone but the owner, once the rule question is answered). */
  readonly selectable: boolean;
  /** Copies the visitor offers; undefined when the card is not ticked. */
  readonly selectedCopies: number | undefined;
  readonly onToggle: () => void;
  readonly onCopies: (copies: number) => void;
}

function CopiesStepper({ row, label, copies, onCopies }: { readonly row: IGiveRow; readonly label: string; readonly copies: number; readonly onCopies: (copies: number) => void }): React.ReactElement {
  const { t } = useTranslation();
  return (
    <div className={styles.stepper} data-testid="offer-stepper">
      <button
        type="button"
        className={styles.stepButton}
        aria-label={t('sharing.missingPage.copiesLess', { name: label })}
        disabled={copies <= 1}
        onClick={() => onCopies(copies - 1)}
      >
        <span aria-hidden="true">&minus;</span>
      </button>
      <span className={styles.stepValue} data-testid="offer-copies" aria-live="polite">
        {copies}
      </span>
      <button
        type="button"
        className={styles.stepButton}
        aria-label={t('sharing.missingPage.copiesMore', { name: label })}
        disabled={copies >= row.copies}
        onClick={() => onCopies(copies + 1)}
      >
        <span aria-hidden="true">+</span>
      </button>
      <span className={styles.stepOf}>{t('sharing.missingPage.copiesOf', { count: row.copies })}</span>
    </div>
  );
}

function GiveRow({ row, askRule, selectable, selectedCopies, onToggle, onCopies }: IGiveRowProps): React.ReactElement {
  const { t } = useTranslation();
  const label = cardName(row.card.name, row.card.pitch, (key) => t(key));
  const selected = selectedCopies !== undefined;
  return (
    <li className={selected ? `${styles.row} ${styles.rowSelected}` : styles.row} data-testid="shared-card">
      {selectable && (
        <label className={styles.check}>
          <input
            type="checkbox"
            className={styles.checkInput}
            checked={selected}
            onChange={onToggle}
            aria-label={t('sharing.missingPage.selectAria', { name: label })}
          />
          <span className={styles.checkBox} aria-hidden="true" />
        </label>
      )}
      <CardThumb card={row.card} label={label} />
      <div className={styles.rowText}>
        <NameLine card={row.card} label={label} />
        <p className={styles.meta}>
          {row.offerable > 0 && !askRule && (
            <>
              <span className={styles.owned} data-testid="shared-owned">
                {t('sharing.missingPage.youHave', { count: row.offerable })}
              </span>
              {row.spare !== null && (
                <>
                  {' · '}
                  <span data-testid="shared-spare">{t('sharing.missingPage.spareCount', { count: row.spare })}</span>
                </>
              )}
              {' · '}
            </>
          )}
          <span>{copiesText(row, t)}</span>
        </p>
      </div>
      {selected && <CopiesStepper row={row} label={label} copies={selectedCopies} onCopies={onCopies} />}
    </li>
  );
}

/** The visitor's rule question, asked before any spare count: the counts of the options come from their own collection. */
function VisitorRuleQuestion(): React.ReactElement | null {
  const query = useSpareQuery();
  if (query.data === undefined) return null;
  return <SpareRuleSheet counts={query.data.counts} initialRule={null} headingKey="spare.groupAsk" embedded />;
}

function flagsOf(card: ISharedCard, t: TTranslate): readonly string[] {
  if (card.foilOnly === true && card.promoOnly === true) return [t('missingList.flagFoilPromo')];
  if (card.foilOnly === true) return [t('missingList.flagFoil')];
  if (card.promoOnly === true) return [t('missingList.flagPromo')];
  return [];
}

function shortfallNote(card: ISharedCard, t: TTranslate): string | null {
  const available = card.availableCopies ?? 0;
  if (available >= card.quantity) return null;
  const rest = card.quantity - available;
  return rest === 1
    ? t('missingList.storeHasOne', { available, next: available + 1 })
    : t('missingList.storeHasMore', { available, rest });
}

function StoreLink({ card, kind }: { readonly card: ISharedCard; readonly kind: 'buy' | 'view' }): React.ReactElement | null {
  const { t } = useTranslation();
  if (card.productUrl === undefined || card.productUrl === null) return null;
  const label = cardName(card.name, card.pitch, (key) => t(key));
  return (
    <a
      className={kind === 'buy' ? styles.buy : styles.view}
      href={card.productUrl}
      target="_blank"
      rel="noopener noreferrer"
      referrerPolicy="no-referrer"
      aria-label={t(kind === 'buy' ? 'missingList.buyAria' : 'missingList.openProductAria', { name: label })}
    >
      {t(kind === 'buy' ? 'missingList.buy' : 'missingList.openProduct')}
      <span aria-hidden="true"> ↗</span>
    </a>
  );
}

function PricedRow({ card }: { readonly card: ISharedCard }): React.ReactElement {
  const { t } = useTranslation();
  const label = cardName(card.name, card.pitch, (key) => t(key));
  const available = card.availableCopies ?? 0;
  const flags = flagsOf(card, t);
  const note = shortfallNote(card, t);
  return (
    <li className={styles.storeRow} data-testid="shared-store-row">
      <div className={styles.storeTop}>
        <CardThumb card={card} label={label} />
        <div className={styles.rowText}>
          <div className={styles.headline}>
            <NameLine card={card} label={label} />
            {card.lineCents != null && <span className={styles.total}>{formatBrl(card.lineCents)}</span>}
          </div>
          <p className={styles.meta}>
            {t('sharing.missingPage.copies', { count: available })}
            {card.unitPriceCents != null && ` · ${t('missingList.eachPrice', { price: formatBrl(card.unitPriceCents) })}`}
          </p>
        </div>
      </div>
      {[...flags, ...(note === null ? [] : [note])].map((text) => (
        <span key={text} className={styles.flag}>
          {text}
        </span>
      ))}
      <StoreLink card={card} kind="buy" />
    </li>
  );
}

function SoonRow({ card }: { readonly card: ISharedCard }): React.ReactElement {
  const { t } = useTranslation();
  const label = cardName(card.name, card.pitch, (key) => t(key));
  return (
    <li className={styles.storeRow} data-testid="shared-store-row">
      <div className={styles.storeTop}>
        <CardThumb card={card} label={label} />
        <div className={styles.rowText}>
          <NameLine card={card} label={label} />
          <p className={styles.meta}>
            {t('sharing.missingPage.copies', { count: card.quantity })} · {t('sharing.missingPage.storeSoon')}
          </p>
        </div>
      </div>
      <StoreLink card={card} kind="view" />
    </li>
  );
}

function StoreSection({ deck }: { readonly deck: ISharedDeckResponse }): React.ReactElement | null {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { priced, soon } = storeRows(deck.missing);
  if (priced.length === 0 && soon.length === 0) return null;
  const summary = deck.storeSummary ?? { copies: 0, cents: 0 };

  return (
    <section className={styles.storeSection} data-testid="shared-store-section">
      <h2 className={styles.storeHeading}>
        <button type="button" className={styles.storeToggle} aria-expanded={open} aria-controls="shared-store-rows" onClick={() => setOpen((on) => !on)}>
          <span>{t('sharing.missingPage.storeTitle')}</span>
          <span className={styles.chevron} aria-hidden="true">
            {open ? '⌃' : '⌄'}
          </span>
        </button>
      </h2>
      <p className={styles.storeSummary}>{t('sharing.missingPage.storeSummary', { count: summary.copies, price: formatBrl(summary.cents) })}</p>
      {open && (
        <div id="shared-store-rows">
          <p className={styles.priceNote}>{t('sharing.missingPage.priceNote')}</p>
          <ul className={styles.list}>
            {priced.map((card) => (
              <PricedRow key={`${card.cardIdentifier}::${card.slot}`} card={card} />
            ))}
            {soon.map((card) => (
              <SoonRow key={`${card.cardIdentifier}::${card.slot}`} card={card} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

interface IOfferBarProps {
  readonly deck: ISharedDeckResponse;
  readonly rows: readonly IGiveRow[];
  readonly selection: TOfferSelection;
  readonly onClear: () => void;
}

/** Sticks to the bottom once a card is ticked: what is selected, "Limpar", and the button that opens the message. */
function OfferBar({ deck, rows, selection, onClear }: IOfferBarProps): React.ReactElement {
  const { t } = useTranslation();
  const items = offerItems(rows, selection);
  return (
    <div className={styles.offerBar} data-testid="offer-bar">
      <p className={styles.offerSummary} role="status">
        {t('sharing.missingPage.selectedCards', { count: items.length })} · {t('sharing.missingPage.selectedCopies', { count: totalCopies(items) })}
      </p>
      <div className={styles.offerActions}>
        <OfferButton
          token={deck.token}
          sharerName={deck.sharerName}
          whatsapp={deck.contactWhatsapp}
          items={items}
          variant="all"
          label={t('sharing.missingPage.offerSelected')}
        />
        <button type="button" className={styles.clear} onClick={onClear}>
          {t('sharing.missingPage.clearSelection')}
        </button>
      </div>
    </div>
  );
}

interface ISharedMissingGalleryProps {
  readonly deck: ISharedDeckResponse;
  /** The page's title block: the left column on a desktop, above the list on a phone. */
  readonly intro?: React.ReactNode;
  /** What closes the left column: the copy button and the glossary link. */
  readonly railActions?: React.ReactNode;
}

/**
 * The missing-cards page body. The left column holds the title, the count and the page's actions; the right one the
 * list people tick what they have from, the bar that offers it, and the store's priced rows collapsed after it. The owner
 * sees the same page with no checkboxes and no counts of their own.
 */
export function SharedMissingGallery({ deck, intro, railActions }: ISharedMissingGalleryProps): React.ReactElement {
  const { t } = useTranslation();
  const [selection, setSelection] = useState<TOfferSelection>(EMPTY_SELECTION);
  const rows = giveRows(deck.missing);
  const askRule = !deck.isOwner && deck.spareNeedsRule === true;
  const selectable = !deck.isOwner && !askRule;
  const owned = rows.filter((row) => row.offerable > 0);
  const showVisitor = selectable && owned.length > 0;
  const ownedCopies = owned.reduce((sum, row) => sum + row.offerable, 0);
  const giveCopies = rows.reduce((sum, row) => sum + row.copies, 0);
  const hasSelection = Object.keys(selection).length > 0;

  return (
    <div className={styles.layout} data-testid="shared-missing">
      <aside className={styles.rail}>
        {intro}
        {showVisitor && (
          <p className={styles.summary} data-testid="shared-owned-summary">
            {t('sharing.missingPage.summaryOwned', { count: ownedCopies, cards: owned.length, name: deck.sharerName })}
          </p>
        )}
        {rows.length > 0 && (
          <div className={styles.giveIntro}>
            <h2 className={styles.sectionTitle}>{t('sharing.missingPage.giveTitle', { name: deck.sharerName })}</h2>
            <p className={styles.sectionHint}>{t('sharing.missingPage.giveHint', { count: giveCopies })}</p>
          </div>
        )}
        {railActions}
      </aside>
      <div className={styles.gallery}>
        {askRule && <VisitorRuleQuestion />}
        {rows.length > 0 && (
          <section className={styles.section}>
            {selectable && (
              <p className={styles.selectHint}>
                <strong>{t('sharing.missingPage.selectHintLead')}</strong> {t('sharing.missingPage.selectHintRest')}
              </p>
            )}
            <ul className={styles.list}>
              {rows.map((row) => {
                const key = giveRowKey(row);
                return (
                  <GiveRow
                    key={key}
                    row={row}
                    askRule={askRule}
                    selectable={selectable}
                    selectedCopies={selection[key]}
                    onToggle={() => setSelection((current) => toggleRow(current, row))}
                    onCopies={(copies) => setSelection((current) => setRowCopies(current, row, copies))}
                  />
                );
              })}
            </ul>
            {hasSelection && <OfferBar deck={deck} rows={rows} selection={selection} onClear={() => setSelection(EMPTY_SELECTION)} />}
          </section>
        )}
        <StoreSection deck={deck} />
      </div>
    </div>
  );
}
