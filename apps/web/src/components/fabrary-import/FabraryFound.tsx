import React, { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  useFabraryPreviewQuery,
  useImportFabraryDeckMutation,
  type IFabraryDeckPreview,
} from '../../api/fabrary-import';
import { localizeApiError } from '../card-scanner/localize-api-error';
import { setPastedList } from '../../lib/pasted-list';
import { FabraryOwnership } from './FabraryOwnership';
import styles from './FabraryFound.module.css';

interface IFabraryFoundProps {
  /** The pasted text; its first Fabrary link is the deck. */
  readonly text: string;
  /** Where a deck imported as "not mine" goes: stay and offer the list, or open the deck as an owned import does. */
  readonly openDeckAfterImport?: boolean;
}

/** What the player is told once the link points at a deck: the deck, how much of it they hold, and the one question. */
export function FabraryFound({ text, openDeckAfterImport = false }: IFabraryFoundProps): React.ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const groupName = useId();
  const preview = useFabraryPreviewQuery(text);
  const importDeck = useImportFabraryDeckMutation();
  const [ownsCards, setOwnsCards] = useState<boolean | null>(null);
  const [importedDeckId, setImportedDeckId] = useState<number | null>(null);

  function submit(): void {
    if (ownsCards === null || importDeck.isPending) return;
    importDeck.mutate(
      { text, ownsCards },
      {
        onSuccess: (response) => {
          if (ownsCards || openDeckAfterImport) {
            void navigate({ to: '/decks/$deckId', params: { deckId: String(response.deckId) }, search: { edit: undefined } });
            return;
          }
          setImportedDeckId(response.deckId);
        },
      },
    );
  }

  function pasteList(): void {
    setPastedList('');
    void navigate({ to: '/add-cards/list' });
  }

  if (preview.isPending) return <p className={styles.status} role="status">{t('fabraryImport.looking')}</p>;
  if (preview.isError) return <p className={styles.error} role="alert">{localizeApiError(preview.error, t)}</p>;
  const deck: IFabraryDeckPreview = preview.data;

  return (
    <section className={styles.card}>
      <p className={styles.found}>
        <span className={styles.check} aria-hidden="true">✓</span>
        {t('fabraryImport.foundTitle', { name: deck.name, count: deck.totalCards })}
      </p>
      <p className={styles.have}>{t('fabraryImport.youHave', { owned: deck.ownedCards, count: deck.totalCards })}</p>
      <FabraryOwnership value={ownsCards} onChange={setOwnsCards} name={groupName} />
      <button type="button" className={styles.primary} disabled={ownsCards === null || importDeck.isPending || importedDeckId !== null} onClick={submit}>
        {importDeck.isPending ? t('fabraryImport.importing') : t('fabraryImport.importDeck')}
      </button>
      {importDeck.isError && <p className={styles.error} role="alert">{localizeApiError(importDeck.error, t)}</p>}
      {importedDeckId !== null && (
        <p className={styles.status} role="status">
          {t('fabraryImport.imported')}{' '}
          <Link to="/decks/$deckId" params={{ deckId: String(importedDeckId) }} search={{ edit: undefined }} className={styles.link}>
            {t('fabraryImport.viewDeck')}
          </Link>
        </p>
      )}
      <button type="button" className={styles.secondary} onClick={pasteList}>
        {t('fabraryImport.pasteList')}
      </button>
    </section>
  );
}
