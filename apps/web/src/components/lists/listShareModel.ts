import { availableLineTexts, formatBrl, type ITextList, type TTranslate } from './listsModel';

const MESSAGE_MAX_LINES = 30;

/**
 * The WhatsApp message of a list link: the cards as text, so a group can
 * answer without opening anything, then the address. Long lists stop at
 * MESSAGE_MAX_LINES and say how many cards the link still holds.
 */
export function buildListShareMessage(list: ITextList, url: string, t: TTranslate): string {
  const available = list.lines.filter((line) => !line.sold);
  const shown = availableLineTexts({ ...list, lines: available.slice(0, MESSAGE_MAX_LINES) }, t);
  const hiddenCards = available.slice(MESSAGE_MAX_LINES).reduce((sum, line) => sum + line.quantity, 0);
  const more = hiddenCards > 0 ? [t('lists.share.messageMore', { count: hiddenCards })] : [];
  const total =
    list.kind === 'sell' && list.totalPriceCents !== null
      ? ['', t('lists.allFor', { price: formatBrl(list.totalPriceCents) })]
      : [];
  return [t(`lists.share.message.${list.kind}`), ...shown, ...more, ...total, '', url].join('\n');
}
