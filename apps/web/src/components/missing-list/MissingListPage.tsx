import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDeckDetailQuery } from '../../api/deck-detail';
import { useMissingListQuery, type IMissingLine } from '../../api/missing-list';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { ShareDialog } from '../deck-detail/ShareDialog';
import { Skeleton } from '../ui/Skeleton/Skeleton';
import { useToast } from '../ui/Toast/useToast';
import { formatBrl } from '../../utils/format-brl';
import { MissingChips } from './MissingChips';
import { MissingListRow } from './MissingListRow';
import { MissingSections } from './MissingSections';
import { MissingSummary } from './MissingSummary';
import {
  defaultChip,
  hasInventoryCopies,
  lineInChip,
  lineOnSide,
  missingTotals,
  pricedLines,
  type TChip,
  type TSide,
} from './missingListModel';
import { buildShoppingListText } from './shoppingListText';
import styles from './MissingListPage.module.css';

interface IMissingListPageProps {
  readonly deckId: number;
}

const PHONE_QUERY = '(max-width: 719px)';
const PHONE_VISIBLE_ROWS = 6;
const SIDES: readonly TSide[] = ['all', 'deck', 'inventory'];
const SIDE_LABEL_KEY: Readonly<Record<TSide, string>> = {
  all: 'missingList.sideAll',
  deck: 'missingList.sideDeck',
  inventory: 'missingList.sideInventory',
};

interface IActionsProps {
  readonly onShare: () => void;
  readonly onCopy: () => void;
  readonly shareFirst: boolean;
}

function ListActions({ onShare, onCopy, shareFirst }: IActionsProps): React.ReactElement {
  const { t } = useTranslation();
  const share = (
    <button type="button" className={styles.primary} onClick={onShare}>
      {t('missingList.share')}
    </button>
  );
  const copy = (
    <button type="button" className={styles.secondary} onClick={onCopy}>
      {t('missingList.copy')}
    </button>
  );
  return <div className={styles.actions}>{shareFirst ? <>{share}{copy}</> : <>{copy}{share}</>}</div>;
}

function InventoryHead({ lines, side, onSide }: { readonly lines: readonly IMissingLine[]; readonly side: TSide; readonly onSide: (side: TSide) => void }): React.ReactElement {
  const { t } = useTranslation();
  const totals = missingTotals(lines);
  return (
    <div className={styles.head} data-testid="missing-head">
      <p className={styles.headText}>
        {t('missingList.head', {
          count: totals.copies,
          cards: totals.cards,
          split: t('deckDetail.missingSplit', { deck: totals.deck, inventory: totals.inventory }),
        })}
      </p>
      <div role="group" aria-label={t('missingList.sidesAria')} className={styles.sides}>
        {SIDES.map((option) => (
          <button
            key={option}
            type="button"
            className={option === side ? `${styles.side} ${styles.sideActive}` : styles.side}
            aria-pressed={option === side}
            onClick={() => onSide(option)}
          >
            {t(SIDE_LABEL_KEY[option])}
          </button>
        ))}
      </div>
    </div>
  );
}

function TableHead(): React.ReactElement {
  const { t } = useTranslation();
  return (
    <thead>
      <tr>
        <th scope="col">{t('missingList.columnCard')}</th>
        <th scope="col" className={styles.numHead}>{t('missingList.columnNeeded')}</th>
        <th scope="col">{t('missingList.columnOwned')}</th>
        <th scope="col">{t('missingList.columnStandIn')}</th>
        <th scope="col" className={styles.numHead}>{t('missingList.columnUnit')}</th>
        <th scope="col" className={styles.numHead}>{t('missingList.columnTotal')}</th>
        <th scope="col" className={styles.numHead}>{t('missingList.columnLink')}</th>
      </tr>
    </thead>
  );
}

/** The owner's missing list: what the deck still needs, the real total, and one action per card. */
export function MissingListPage({ deckId }: IMissingListPageProps): React.ReactElement {
  const { t } = useTranslation();
  const { show } = useToast();
  const phone = useMediaQuery(PHONE_QUERY);
  const query = useMissingListQuery(deckId);
  const deckQuery = useDeckDetailQuery(String(deckId));
  const [chip, setChip] = useState<TChip | null>(null);
  const [side, setSide] = useState<TSide>('all');
  const [expanded, setExpanded] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  if (query.isLoading) {
    return (
      <div className={styles.page} role="status" aria-label={t('missingList.pageAria')}>
        <Skeleton height="320px" />
      </div>
    );
  }
  if (query.isError || query.data === undefined) {
    return (
      <div className={styles.page}>
        <p role="alert" className={styles.error}>
          {t('missingList.loadError')}
        </p>
        <button type="button" className={styles.secondary} onClick={() => void query.refetch()}>
          {t('missingList.retry')}
        </button>
      </div>
    );
  }

  const { summary, lines } = query.data;
  const deck = deckQuery.data;
  const activeChip = chip ?? defaultChip(lines);
  const rows = lines.filter((line) => lineInChip(line, activeChip) && lineOnSide(line, side));
  const shown = phone && !expanded ? rows.slice(0, PHONE_VISIBLE_ROWS) : rows;
  const hidden = rows.length - shown.length;
  const nothingMissing = missingTotals(lines).copies === 0 && lines.every((line) => line.standIn === null);

  async function handleCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(buildShoppingListText(lines, deck?.name ?? '', deck?.hero ?? '', t));
      show({ kind: 'success', message: t('missingList.copied') });
    } catch {
      show({ kind: 'error', message: t('missingList.copyFailed') });
    }
  }

  const actions = <ListActions onShare={() => setShareOpen(true)} onCopy={() => void handleCopy()} shareFirst={phone} />;
  const pricedCards = pricedLines(lines).length;

  return (
    <div className={styles.page} data-testid="missing-list-page" data-layout={phone ? 'phone' : 'desktop'}>
      <header className={styles.summaryBar}>
        <MissingSummary summary={summary} lines={lines} />
        {!phone && actions}
      </header>

      {nothingMissing ? (
        <p className={styles.empty}>{t('missingList.empty')}</p>
      ) : (
        <>
          <MissingChips summary={summary} lines={lines} active={activeChip} onSelect={(next) => { setChip(next); setExpanded(false); }} />
          {hasInventoryCopies(lines) && <InventoryHead lines={lines} side={side} onSide={setSide} />}

          {rows.length === 0 ? (
            <p className={styles.empty}>{t('missingList.emptyFilter')}</p>
          ) : phone ? (
            <ul className={styles.cardList}>
              {shown.map((line) => (
                <MissingListRow key={line.cardIdentifier} deckId={deckId} line={line} layout="card" />
              ))}
              {hidden > 0 && (
                <li className={styles.more}>
                  <button type="button" className={styles.moreButton} aria-label={t('missingList.moreCardsAria', { count: hidden })} onClick={() => setExpanded(true)}>
                    {t('missingList.moreCards', { count: hidden })}
                  </button>
                </li>
              )}
            </ul>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table} aria-label={t('missingList.tableAria')}>
                <TableHead />
                <tbody>
                  {rows.map((line) => (
                    <MissingListRow key={line.cardIdentifier} deckId={deckId} line={line} layout="table" />
                  ))}
                </tbody>
                {activeChip === 'buy' && summary.buyCopies > 0 && (
                  <tfoot>
                    <tr>
                      <td colSpan={7} className={styles.footer} data-testid="missing-footer">
                        {t('missingList.footer', { cards: pricedCards, copies: summary.buyCopies, price: formatBrl(summary.buyCents) })}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}

          {!phone && activeChip === 'buy' && <MissingSections lines={lines} />}
        </>
      )}

      {phone && (
        <div className={styles.bottomBar} role="group" aria-label={t('missingList.barAria')}>
          {actions}
        </div>
      )}

      <ShareDialog
        deckId={deckId}
        deckName={deck?.name ?? ''}
        missingCount={summary.lacksCopies + summary.notOnSiteCopies}
        open={shareOpen}
        initialIntent="missing"
        onOpenChange={setShareOpen}
      />
    </div>
  );
}
