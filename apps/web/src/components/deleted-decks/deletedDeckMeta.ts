import type { TFunction } from 'i18next';
import type { IDeletedDeck } from '../../api/deleted-decks';
import { STATUS_KEY_MAP } from '../deck-detail/status-labels';

const DAY_MS = 24 * 60 * 60 * 1000;

/** "Ideia · 12 cartas · excluído hoje · some de vez em 30 dias". */
export function deletedDeckMeta(deck: IDeletedDeck, now: Date, t: TFunction): string {
  const daysAgo = Math.max(0, Math.floor((now.getTime() - new Date(deck.deletedAt).getTime()) / DAY_MS));
  const daysLeft = Math.max(0, Math.ceil((new Date(deck.purgeAt).getTime() - now.getTime()) / DAY_MS));
  const when =
    daysAgo === 0
      ? t('home.deletedToday')
      : daysAgo === 1
        ? t('home.deletedYesterday')
        : t('home.deletedDaysAgo', { count: daysAgo });
  return [
    t(STATUS_KEY_MAP[deck.status]),
    t('home.deletedCards', { count: deck.totalCards }),
    when,
    t('home.deletedPurgeIn', { count: daysLeft }),
  ].join(' · ');
}
