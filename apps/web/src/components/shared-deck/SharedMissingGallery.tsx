import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ISharedCard, ISharedDeckResponse } from '../../api/shared-decks';
import { cardName } from '../../lib/card-name';
import { formatBrl } from '../../utils/format-brl';
import { useSpareQuery } from '../../api/spare';
import { SpareRuleSheet } from '../spare/SpareRuleSheet';
import { OfferButton } from './OfferButton';
import { giveRows, inventorySplit, storeRows, type IGiveRow } from './sharedMissingModel';
import styles from './SharedMissingGallery.module.css';

interface ISharedMissingGalleryProps {
  readonly deck: ISharedDeckResponse;
}

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

function GiveRow({ row, deck, askRule }: { readonly row: IGiveRow; readonly deck: ISharedDeckResponse; readonly askRule: boolean }): React.ReactElement {
  const { t } = useTranslation();
  const label = cardName(row.card.name, row.card.pitch, (key) => t(key));
  const offerCount = row.offerable > 0 ? row.offerable : row.copies;
  return (
    <li className={styles.row} data-testid="shared-card">
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
      {!deck.isOwner && !askRule && (
        <OfferButton
          token={deck.token}
          sharerName={deck.sharerName}
          whatsapp={deck.contactWhatsapp}
          items={[{ name: row.card.name, pitch: row.card.pitch, count: offerCount }]}
          variant="single"
          label={t('sharing.missingPage.offer')}
          ariaLabel={t('sharing.missingPage.offerAria', { name: label })}
        />
      )}
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

/**
 * The missing-cards page body: what people can give first, one "Oferecer" per card, and the store's priced rows
 * collapsed after it. The owner sees the same page with no offer buttons and no counts of their own.
 */
export function SharedMissingGallery({ deck }: ISharedMissingGalleryProps): React.ReactElement {
  const { t } = useTranslation();
  const rows = giveRows(deck.missing);
  const askRule = !deck.isOwner && deck.spareNeedsRule === true;
  const owned = rows.filter((row) => row.offerable > 0);
  const showVisitor = !deck.isOwner && !askRule && owned.length > 0;
  const ownedCopies = owned.reduce((sum, row) => sum + row.offerable, 0);
  const giveCopies = rows.reduce((sum, row) => sum + row.copies, 0);

  return (
    <div className={styles.gallery} data-testid="shared-missing">
      {askRule && <VisitorRuleQuestion />}
      {showVisitor && (
        <>
          <p className={styles.summary} data-testid="shared-owned-summary">
            {t('sharing.missingPage.summaryOwned', { count: ownedCopies, cards: owned.length, name: deck.sharerName })}
          </p>
        </>
      )}
      {rows.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('sharing.missingPage.giveTitle', { name: deck.sharerName })}</h2>
          <p className={styles.sectionHint}>{t('sharing.missingPage.giveHint', { count: giveCopies })}</p>
          {showVisitor && (
            <OfferButton
              token={deck.token}
              sharerName={deck.sharerName}
              whatsapp={deck.contactWhatsapp}
              items={owned.map((row) => ({ name: row.card.name, pitch: row.card.pitch, count: row.offerable }))}
              variant="all"
              label={t('sharing.missingPage.offerAll', { count: owned.length })}
            />
          )}
          <ul className={styles.list}>
            {rows.map((row) => (
              <GiveRow key={`${row.card.cardIdentifier}::${row.card.slot}`} row={row} deck={deck} askRule={askRule} />
            ))}
          </ul>
        </section>
      )}
      <StoreSection deck={deck} />
    </div>
  );
}
