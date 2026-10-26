import React, { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useDecideProposal, useUndoSwap, type IDeckProposal, type ISwapProposal, type TChatProposal } from '../../api/chat';
import { useDecksQuery } from '../../api/decks';
import { localizeApiError } from '../card-scanner/localize-api-error';
import { Button } from '../ui/Button/Button';
import { VarFill } from '../deck-detail/VarFill';
import { DeckChip } from './DeckChip';
import { CardLightbox } from '../card-art/CardLightbox';
import { imageSources } from '../deck-detail/recommendations/card-naming';
import { cardName } from '../../lib/card-name';
import { useImageFallback } from '../../hooks/useImageFallback';
import { copiesLeftLine, effectLine, incomingNote, swapViewOf, whyThisCard } from './swapProposalModel';
import styles from './ProposalCard.module.css';

const LISTED_CARDS = 4;
const PITCH_CLASS: Readonly<Record<number, string | undefined>> = { 1: styles.pitchRed, 2: styles.pitchYellow, 3: styles.pitchBlue };

function PitchDot({ pitch }: { readonly pitch: number | null }): React.ReactElement {
  return (
    <span
      className={`${styles.pitch} ${(pitch !== null && PITCH_CLASS[pitch]) || styles.pitchNone}`}
      data-pitch={pitch ?? 'none'}
      aria-hidden="true"
    />
  );
}

function DeckBody({ proposal }: { readonly proposal: IDeckProposal }): React.ReactElement {
  const { t } = useTranslation();
  const { cards } = proposal.display;
  const total = cards.reduce((sum, card) => sum + card.quantity, 0);
  const ownedShare = total === 0 ? 0 : (proposal.ownedCount / total) * 100;
  return (
    <>
      <h3 className={styles.name}>{proposal.payload.name}</h3>
      <p className={styles.meta}>
        {t('chat.proposal.deckMeta', { hero: proposal.display.heroName, format: proposal.payload.format, count: total })}
      </p>
      <p className={styles.reason}>{proposal.reason}</p>
      <div
        className={styles.bar}
        role="img"
        aria-label={t('chat.proposal.ownedBarAria', { owned: proposal.ownedCount, total })}
      >
        <VarFill className={styles.barOwned!} cssVar="--owned-share" value={`${ownedShare}%`} testId="owned-share" />
      </div>
      <p className={styles.counts}>
        <span className={styles.owned}>{t('chat.proposal.owned', { count: proposal.ownedCount })}</span>
        <span className={styles.missing}>{t('chat.proposal.missing', { count: proposal.missingCount })}</span>
      </p>
      <ul className={styles.cards}>
        {cards.slice(0, LISTED_CARDS).map((card) => {
          const short = card.quantity - card.ownedQuantity;
          return (
            <li key={`${card.cardIdentifier}@${card.slot}`} className={styles.cardRow} data-testid="proposal-card-row">
              <span className={styles.quantity}>{`${card.quantity}x`}</span>
              <PitchDot pitch={card.pitch} />
              <span className={styles.cardName}>{cardName(card.name, card.pitch, t)}</span>
              <span className={short === 0 ? styles.has : styles.lacks}>
                {short === 0 ? t('chat.proposal.cardOwned') : t('chat.proposal.cardMissing', { count: short })}
              </span>
            </li>
          );
        })}
        {cards.length > LISTED_CARDS && (
          <li className={styles.more}>{t('chat.proposal.more', { count: cards.length - LISTED_CARDS })}</li>
        )}
      </ul>
    </>
  );
}

function SwapSide({
  label,
  card,
  text,
  testId,
  className,
  onPreview,
}: {
  readonly label: string;
  readonly card: ISwapProposal['display']['original' | 'replacement'];
  readonly text: { readonly quantity: number; readonly name: string; readonly note: React.ReactNode; readonly testId: string; readonly stop: string };
  readonly testId: string;
  readonly className: string;
  readonly onPreview: () => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const { src, onError } = useImageFallback(imageSources(card.imageUrl, 'large'));
  const displayName = cardName(card.name, card.pitch, t);
  return (
    <div className={`${styles.side} ${className}`} data-testid={testId}>
      {src === null ? (
        <span className={`${styles.art} ${styles.artFallback}`} data-testid="swap-art-fallback">
          {displayName}
        </span>
      ) : (
        <button type="button" className={styles.art} aria-label={t('chat.proposal.previewAria', { name: displayName })} onClick={onPreview}>
          <img className={styles.artImage} src={src} alt={displayName} onError={onError} draggable={false} />
        </button>
      )}
      <div className={styles.sideText} data-testid={text.testId}>
        <span className={styles.sideLabel}>{label}</span>
        <span className={styles.srOnly}>: </span>
        <span className={styles.sideCard}>
          <span className={styles.sideQuantity}>{text.quantity}</span>
          <span className={styles.srOnly}> </span>
          <PitchDot pitch={card.pitch} />
          <span>{text.name}</span>
        </span>
        <span className={styles.srOnly}>{text.stop} </span>
        {text.note}
      </div>
    </div>
  );
}

function SwapBody({ proposal, deckName }: { readonly proposal: ISwapProposal; readonly deckName: string | null }): React.ReactElement {
  const { t } = useTranslation();
  const { original, replacement } = proposal.display;
  const { quantity, side, effect } = swapViewOf(proposal);
  const [preview, setPreview] = useState<typeof original | typeof replacement | null>(null);
  const why = whyThisCard(proposal.display, t);
  const outSuffix = t(side === 'deck' ? 'chat.proposal.outDeck' : 'chat.proposal.outInventory', { count: quantity });
  return (
    <>
      {deckName !== null && proposal.trackedDeckId !== null && (
        <div className={styles.chipRow}>
          <DeckChip deckId={proposal.trackedDeckId} name={deckName} />
        </div>
      )}
      <div className={styles.swap}>
        <SwapSide
          label={t('chat.proposal.out')}
          card={original}
          text={{
            quantity,
            name: `${cardName(original.name, original.pitch, t)}${outSuffix}`,
            note: <span className={styles.sideNote}>{copiesLeftLine(original.copiesLeft, t)}</span>,
            testId: 'swap-out-text',
            stop: '.',
          }}
          testId="swap-out"
          className={styles.sideOut!}
          onPreview={() => setPreview(original)}
        />
        <span className={styles.arrow} aria-hidden="true">
          →
        </span>
        <SwapSide
          label={t('chat.proposal.in')}
          card={replacement}
          text={{
            quantity,
            name: `${cardName(replacement.name, replacement.pitch, t)}${t(side === 'deck' ? 'chat.proposal.inDeck' : 'chat.proposal.inInventory')}`,
            note: <span className={replacement.freeCopies > 0 ? styles.has : styles.lacks}>{incomingNote(replacement, t)}</span>,
            testId: 'swap-in-text',
            stop: '',
          }}
          testId="swap-in"
          className={styles.sideIn!}
          onPreview={() => setPreview(replacement)}
        />
      </div>
      <p className={styles.reason}>{proposal.reason}</p>
      {why !== null && (
        <p className={styles.why} data-testid="swap-why">
          <strong>{t('chat.proposal.whyLabel')}</strong> {why}
        </p>
      )}
      {effect !== null && (
        <p className={styles.effect} data-testid="swap-effect">
          {effectLine(effect, t)}
        </p>
      )}
      {preview !== null && preview.imageUrl !== null && (
        <CardLightbox
          imageUrl={preview.imageUrl.large}
          sources={imageSources(preview.imageUrl, 'large')}
          name={preview.name}
          onClose={() => setPreview(null)}
        />
      )}
    </>
  );
}

export function ProposalCard({ conversationId, proposal }: { readonly conversationId: string; readonly proposal: TChatProposal }): React.ReactElement {
  const { t } = useTranslation();
  const apply = useDecideProposal(conversationId, 'apply');
  const dismiss = useDecideProposal(conversationId, 'dismiss');
  const undo = useUndoSwap(conversationId);
  const decks = useDecksQuery();
  const [error, setError] = useState<string | null>(null);
  const deckName = decks.data?.trackedDecks.find((deck) => deck.id === proposal.trackedDeckId)?.name ?? null;
  const busy = apply.isPending || dismiss.isPending || undo.isPending;

  function undoSwap(replacementId: string): void {
    setError(null);
    undo.mutate(replacementId, { onError: (cause) => setError(localizeApiError(cause, t)) });
  }

  function decide(mutation: typeof apply): void {
    setError(null);
    mutation.mutate(proposal.id, { onError: (cause) => setError(localizeApiError(cause, t)) });
  }

  return (
    <article className={styles.card} data-status={proposal.status} data-testid="proposal-card">
      <header className={styles.head}>
        <span className={styles.kind}>{proposal.kind === 'deck' ? t('chat.proposal.deckLabel') : t('chat.proposal.swapLabel')}</span>
        <span className={styles.status} data-testid="proposal-status">
          {t(`chat.proposal.status.${proposal.status}`)}
        </span>
      </header>
      {proposal.kind === 'deck' ? <DeckBody proposal={proposal} /> : <SwapBody proposal={proposal} deckName={deckName} />}
      {proposal.status === 'stale' && <p className={styles.note}>{t('chat.proposal.stale')}</p>}
      {proposal.status === 'applied' && proposal.kind === 'deck' && (
        <div className={styles.actions}>
          <span className={styles.note}>{t('chat.proposal.deckCreated')}</span>
          {proposal.trackedDeckId !== null && (
            <Link to="/decks/$deckId" params={{ deckId: String(proposal.trackedDeckId) }} search={{ edit: undefined }} className={styles.openDeck}>
              {t('chat.proposal.openDeck')}
            </Link>
          )}
        </div>
      )}
      {proposal.status === 'applied' && proposal.kind === 'swap' && (
        <div className={styles.actions}>
          <span className={styles.note}>
            {proposal.replacementStatus === 'reverted'
              ? t('chat.proposal.swapUndone')
              : proposal.replacementStatus === 'removed'
                ? t('chat.proposal.swapRemoved')
                : t('chat.proposal.swapDone')}
          </span>
          {proposal.replacementStatus === 'active' && proposal.cardReplacementId !== null && (
            <Button variant="secondary" size="sm" loading={undo.isPending} disabled={busy} onClick={() => undoSwap(proposal.cardReplacementId!)}>
              {t('chat.proposal.undo')}
            </Button>
          )}
          {proposal.trackedDeckId !== null && (
            <Link to="/decks/$deckId" params={{ deckId: String(proposal.trackedDeckId) }} search={{ edit: undefined }} className={styles.viewDeck}>
              {t('chat.proposal.viewDeck')}
            </Link>
          )}
        </div>
      )}
      {proposal.status === 'pending' && (
        <div className={styles.actions}>
          <Button variant="primary" size="sm" loading={apply.isPending} disabled={busy} onClick={() => decide(apply)}>
            {proposal.kind === 'deck' ? t('chat.proposal.apply') : t('chat.proposal.applySwap', { count: swapViewOf(proposal).quantity })}
          </Button>
          <Button variant="secondary" size="sm" loading={dismiss.isPending} disabled={busy} onClick={() => decide(dismiss)}>
            {t('chat.proposal.dismiss')}
          </Button>
        </div>
      )}
      {error !== null && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </article>
  );
}
