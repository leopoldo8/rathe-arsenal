import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { IMissingLine } from '../../api/missing-list';
import { cardName } from '../../lib/card-name';
import { formatBrl } from '../../utils/format-brl';
import { neededCopies } from './missingListModel';
import { MissingStandIn } from './MissingStandIn';
import { OwnedStepper } from './OwnedStepper';
import styles from './MissingListRow.module.css';

export type TRowLayout = 'card' | 'table';

interface IMissingListRowProps {
  readonly deckId: number;
  readonly line: IMissingLine;
  readonly layout?: TRowLayout;
}

const PITCH_CLASS: Readonly<Record<number, string>> = {
  1: styles.pitchRed ?? '',
  2: styles.pitchYellow ?? '',
  3: styles.pitchBlue ?? '',
};

type TTranslate = ReturnType<typeof useTranslation>['t'];

function flagsOf(line: IMissingLine, t: TTranslate): readonly string[] {
  const flags: string[] = [];
  if (line.foilOnly && line.promoOnly) flags.push(t('missingList.flagFoilPromo'));
  else if (line.foilOnly) flags.push(t('missingList.flagFoil'));
  else if (line.promoOnly) flags.push(t('missingList.flagPromo'));
  return flags;
}

function shortfallNote(line: IMissingLine, t: TTranslate): string | null {
  const needed = neededCopies(line);
  const available = line.availableCopies;
  if (line.state !== 'priced' || available === null || available >= needed) return null;
  const rest = needed - available;
  return rest === 1
    ? t('missingList.storeHasOne', { available, next: available + 1 })
    : t('missingList.storeHasMore', { available, rest });
}

function flagsWithShortfall(line: IMissingLine, t: TTranslate): readonly string[] {
  const note = shortfallNote(line, t);
  return note === null ? flagsOf(line, t) : [...flagsOf(line, t), note];
}

function CardImage({ line }: { readonly line: IMissingLine }): React.ReactElement {
  return line.imageUrl === null ? (
    <span className={styles.imagePlaceholder} aria-hidden="true" />
  ) : (
    <img className={styles.image} src={line.imageUrl} alt="" loading="lazy" />
  );
}

function NameBlock({ line, name }: { readonly line: IMissingLine; readonly name: string }): React.ReactElement {
  return (
    <span className={styles.nameLine}>
      {line.pitch !== null && <span className={`${styles.pitchDot} ${PITCH_CLASS[line.pitch] ?? ''}`} aria-hidden="true" />}
      <span className={styles.name}>{name}</span>
    </span>
  );
}

/** What the row says where the price goes: the price, "buscando preço…" or "sem preço agora". */
function priceLine(line: IMissingLine, t: TTranslate): string | null {
  const needed = neededCopies(line);
  if (line.state === 'looking_up') return t('missingList.lookingUpPrice');
  if (line.state === 'no_price') return t('missingList.noPriceHere');
  if (line.state === 'store_lacks') return t('missingList.storeLacks');
  if (line.state === 'not_on_site') return t('missingList.notOnSite');
  if (line.unitPriceCents === null) return null;
  const showEach = needed > 1 || line.ownedTotal > 0;
  return t(showEach ? 'missingList.eachPrice' : 'missingList.onlyPrice', { price: formatBrl(line.unitPriceCents) });
}

function neededText(line: IMissingLine, t: TTranslate): string {
  const needed = neededCopies(line);
  const parts = [t('missingList.needed', { count: needed })];
  if (line.ownedTotal > 0 && needed > 0 && line.inventoryNeeded === 0) parts[0] += ` ${t('missingList.youHave', { count: line.ownedTotal })}`;
  if (line.inventoryNeeded > 0) parts.push(t('missingList.fromInventory', { count: line.inventoryNeeded }));
  return parts.join(' · ');
}

function StoreLink({ line, name, className }: { readonly line: IMissingLine; readonly name: string; readonly className: string }): React.ReactElement | null {
  const { t } = useTranslation();
  if (line.state === 'priced' && line.productUrl !== null) {
    return (
      <a className={className} href={line.productUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" aria-label={t('missingList.buyAria', { name })}>
        {t('missingList.buy')}
        <span aria-hidden="true"> ↗</span>
      </a>
    );
  }
  if (line.state === 'no_price' && line.productUrl !== null) {
    return (
      <a className={className} href={line.productUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" aria-label={t('missingList.openProductAria', { name })}>
        {t('missingList.openProduct')}
        <span aria-hidden="true"> ↗</span>
      </a>
    );
  }
  if (line.state === 'not_on_site' && line.searchUrl !== null) {
    return (
      <a className={className} href={line.searchUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" aria-label={t('missingList.searchThereAria', { name })}>
        {t('missingList.searchThere')}
        <span aria-hidden="true"> ↗</span>
      </a>
    );
  }
  return null;
}

function CardRow({ deckId, line }: { readonly deckId: number; readonly line: IMissingLine }): React.ReactElement {
  const { t } = useTranslation();
  const [stepperOpen, setStepperOpen] = useState(false);
  const name = cardName(line.name, line.pitch, t);
  const flags = flagsWithShortfall(line, t);
  const price = priceLine(line, t);
  const open = neededCopies(line) > 0;
  const showTotal = open && line.state === 'priced' && line.lineCents !== null;
  const inlineLink = line.state === 'no_price' || line.state === 'not_on_site';

  return (
    <li className={styles.card} data-testid="missing-row" data-state={line.state}>
      <div className={styles.top}>
        <CardImage line={line} />
        <div className={styles.main}>
          <div className={styles.headline}>
            <NameBlock line={line} name={name} />
            {showTotal && <span className={styles.total}>{formatBrl(line.lineCents ?? 0)}</span>}
          </div>
          <p className={styles.meta}>
            {open && <span>{neededText(line, t)}</span>}
            {open && price !== null && (
              <>
                {' · '}
                <span data-testid="missing-row-price">{price}</span>
                {inlineLink && (
                  <>
                    {' · '}
                    <StoreLink line={line} name={name} className={styles.inline ?? ''} />
                  </>
                )}
              </>
            )}
          </p>
        </div>
      </div>
      {flags.length > 0 && (
        <ul className={styles.flags}>
          {flags.map((flag) => (
            <li key={flag} className={styles.flag}>
              {flag}
            </li>
          ))}
        </ul>
      )}
      <MissingStandIn deckId={deckId} line={line} />
      {stepperOpen ? (
        <OwnedStepper deckId={deckId} line={line} onPicked={() => setStepperOpen(false)} />
      ) : (
        <div className={styles.actions}>
          <button type="button" className={styles.have} aria-label={t('missingList.alreadyHaveAria', { name })} onClick={() => setStepperOpen(true)}>
            {t('missingList.alreadyHave')}
          </button>
          {open && !inlineLink && <StoreLink line={line} name={name} className={styles.buy ?? ''} />}
        </div>
      )}
    </li>
  );
}

function TableRow({ deckId, line }: { readonly deckId: number; readonly line: IMissingLine }): React.ReactElement {
  const { t } = useTranslation();
  const name = cardName(line.name, line.pitch, t);
  const flags = flagsWithShortfall(line, t);
  const needed = neededCopies(line);
  const inStore = line.state === 'priced' && line.availableCopies !== null && line.availableCopies < needed ? line.availableCopies : null;
  const price = priceLine(line, t);
  const priced = line.state === 'priced' && needed > 0;

  return (
    <tr className={styles.tableRow} data-testid="missing-row" data-state={line.state}>
      <td>
        <div className={styles.cardCell}>
          <CardImage line={line} />
          <div className={styles.cardCellText}>
            <NameBlock line={line} name={name} />
            {flags.map((flag) => (
              <span key={flag} className={styles.flag}>
                {flag}
              </span>
            ))}
            {!priced && price !== null && <span className={styles.meta}>{price}</span>}
          </div>
        </div>
      </td>
      <td className={styles.numCell}>
        <span>{needed}</span>
        {line.inventoryNeeded > 0 && <span className={styles.sub}>{t('missingList.fromInventory', { count: line.inventoryNeeded })}</span>}
        {inStore !== null && <span className={styles.sub}>{t('missingList.inStore', { count: inStore })}</span>}
      </td>
      <td className={styles.ownedCell}>
        <OwnedStepper deckId={deckId} line={line} showTitle={false} />
      </td>
      <td className={styles.standInCell}>
        <MissingStandIn deckId={deckId} line={line} />
      </td>
      <td className={styles.priceCell}>{priced && line.unitPriceCents !== null ? formatBrl(line.unitPriceCents) : ''}</td>
      <td className={styles.totalCell}>{priced && line.lineCents !== null ? formatBrl(line.lineCents) : ''}</td>
      <td className={styles.linkCell}>
        {needed > 0 && <StoreLink line={line} name={name} className={styles.buy ?? ''} />}
      </td>
    </tr>
  );
}

export function MissingListRow({ deckId, line, layout = 'card' }: IMissingListRowProps): React.ReactElement {
  return layout === 'table' ? <TableRow deckId={deckId} line={line} /> : <CardRow deckId={deckId} line={line} />;
}
