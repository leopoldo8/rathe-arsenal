import type { TFunction } from 'i18next';
import type { ISwapCardFacts, ISwapProposal } from '../../api/chat';
import { cardName } from '../../lib/card-name';
import { formatBrl } from '../../utils/format-brl';

type TSwapDisplay = ISwapProposal['display'];

const KIND_KEYS: Readonly<Record<string, string>> = {
  Action: 'chat.proposal.kindAction',
  'Attack Reaction': 'chat.proposal.kindAttackReaction',
  'Defense Reaction': 'chat.proposal.kindDefenseReaction',
  Instant: 'chat.proposal.kindInstant',
  Weapon: 'chat.proposal.kindWeapon',
  Equipment: 'chat.proposal.kindEquipment',
};

export interface ISwapView {
  /** The copies the swap moves; a proposal stored before the swap carried them moves "every copy", read as the deck's copies. */
  readonly quantity: number;
  readonly side: 'deck' | 'inventory';
  readonly effect: { readonly before: number; readonly after: number } | null;
}

export function swapViewOf(proposal: ISwapProposal): ISwapView {
  const { quantity, side, missingBefore, missingAfter } = proposal.payload;
  return {
    quantity: quantity ?? proposal.display.original.copiesInDeck,
    side: side ?? 'deck',
    effect: missingBefore === undefined || missingAfter === undefined ? null : { before: missingBefore, after: missingAfter },
  };
}

function kindOf(facts: ISwapCardFacts, t: TFunction): string {
  if (facts.subtypes.includes('Attack')) return t('chat.proposal.kindAttack');
  const key = facts.types.map((type) => KIND_KEYS[type]).find((found) => found !== undefined);
  return t(key ?? 'chat.proposal.kindOther');
}

function statsOf(facts: ISwapCardFacts, t: TFunction): string {
  const cost = facts.cost === null ? '' : t('chat.proposal.statCost', { count: facts.cost });
  const power = facts.power === null ? '' : t('chat.proposal.statPower', { count: facts.power });
  if (facts.defense === null) return `${cost}${power}`;
  return `${cost}${power}${t(power === '' ? 'chat.proposal.statDefenseAlone' : 'chat.proposal.statDefenseAfterPower', { count: facts.defense })}`;
}

/** "Wounding Blow (Vermelho) é um ataque de custo 0, com 4 de poder e 3 de defesa." from the catalog facts of one card. */
function describeCard(card: TSwapDisplay['original' | 'replacement'], key: 'whyIn' | 'whyOut', t: TFunction): string | null {
  if (card.facts === null) return null;
  return t(`chat.proposal.${key}`, { card: cardName(card.name, card.pitch, t), kind: kindOf(card.facts, t), stats: statsOf(card.facts, t) });
}

export function whyThisCard(display: TSwapDisplay, t: TFunction): string | null {
  const incoming = describeCard(display.replacement, 'whyIn', t);
  const outgoing = describeCard(display.original, 'whyOut', t);
  return incoming === null || outgoing === null ? null : `${incoming} ${outgoing}`;
}

export function copiesLeftLine(copiesLeft: number, t: TFunction): string {
  return copiesLeft === 0 ? t('chat.proposal.copiesLeftNone') : t('chat.proposal.copiesLeft', { count: copiesLeft });
}

/** "você não tem nenhuma na coleção · R$ 2,50 na Cúpula DT" */
export function incomingNote(replacement: TSwapDisplay['replacement'], t: TFunction): string {
  const owned = replacement.freeCopies > 0 ? t('chat.proposal.freeCopies', { count: replacement.freeCopies }) : t('chat.proposal.noFreeCopies');
  const price =
    replacement.storePriceCents === null
      ? t('chat.proposal.noStorePrice')
      : t('chat.proposal.storePrice', { price: formatBrl(replacement.storePriceCents) });
  return `${owned} · ${price}`;
}

export function effectLine(effect: { readonly before: number; readonly after: number }, t: TFunction): string {
  const missing = effect.after === 0 ? t('chat.proposal.missingNone') : t('chat.proposal.missingCopies', { count: effect.after });
  return t('chat.proposal.effect', { missing, was: t('chat.proposal.was', { count: effect.before }) });
}
