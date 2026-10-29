import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from '@tanstack/react-router';
import { ApiError } from '../../lib/api-client';
import { useImportProductMutation, type IProduct } from '../../api/products';
import { cardName } from '../../lib/card-name';
import { DEFAULT_LIBRARY_SEARCH } from '../../routes/_auth/-library.helpers';
import { recordRecentlyAddedSource } from '../library/RecentlyAddedBanner.helpers';
import styles from './Products.module.css';

interface IProductSwitchProps {
  readonly label: string;
  readonly note: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
}

function ProductSwitch({ label, note, checked, onChange }: IProductSwitchProps): React.ReactElement {
  return (
    <div className={styles.switchRow}>
      <span className={styles.switchText}>
        <span className={styles.switchLabel}>{label}</span>
        <span className={styles.switchNote}>{note}</span>
      </span>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} className={styles.switch} onClick={() => onChange(!checked)} />
    </div>
  );
}

function importedAtOf(error: unknown): string | null {
  if (!(error instanceof ApiError) || error.status !== 409) return null;
  try {
    const body = JSON.parse(error.message) as { code?: string; details?: { importedAt?: string } };
    return body.code === 'PRODUCT_ALREADY_IMPORTED' ? (body.details?.importedAt ?? null) : null;
  } catch {
    return null;
  }
}

/** The product picked: two switches, the cards behind a toggle, one button that adds the box. */
export function ProductConfirm({ product }: { readonly product: IProduct }): React.ReactElement {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const importProduct = useImportProductMutation();
  const [addCards, setAddCards] = useState(true);
  const [createDeck, setCreateDeck] = useState(true);
  const [listOpen, setListOpen] = useState(false);
  const [repeatedOn, setRepeatedOn] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  function submit(confirmRepeat: boolean): void {
    if ((!addCards && !createDeck) || importProduct.isPending) return;
    setFailed(false);
    importProduct.mutate(
      { productKey: product.key, addCards, createDeck, ...(confirmRepeat ? { confirmRepeat: true } : {}) },
      {
        onSuccess: (response) => {
          if (response.source !== undefined) {
            recordRecentlyAddedSource({ kind: 'csv', label: response.source.label, cardCount: response.source.copies });
          }
          if (response.deckId !== undefined) {
            void navigate({ to: '/decks/$deckId', params: { deckId: String(response.deckId) }, search: { edit: undefined } });
          } else {
            void navigate({ to: '/library', search: DEFAULT_LIBRARY_SEARCH });
          }
        },
        onError: (error) => {
          const importedAt = importedAtOf(error);
          if (importedAt !== null) setRepeatedOn(importedAt);
          else setFailed(true);
        },
      },
    );
  }

  const date =
    repeatedOn === null
      ? ''
      : new Intl.DateTimeFormat(i18n.language, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(repeatedOn));

  return (
    <div className={styles.page}>
      <Link to="/add-cards/product" className={styles.back}>
        <span aria-hidden="true">‹ </span>
        {t('products.chooseAnother')}
      </Link>
      <section className={styles.head}>
        {product.hero.imageUrl === null ? (
          <span className={styles.thumb} aria-hidden="true" />
        ) : (
          <img className={styles.thumb} src={product.hero.imageUrl.small} alt="" />
        )}
        <div>
          <h1 className={styles.headTitle}>{t('products.confirmTitle', { name: product.name, count: product.cardCount })}</h1>
          <p className={styles.subtitle}>{product.format}</p>
        </div>
      </section>
      <ProductSwitch
        label={t('products.addCardsLabel', { count: product.cardCount })}
        note={t('products.addCardsNote')}
        checked={addCards}
        onChange={setAddCards}
      />
      <ProductSwitch label={t('products.createDeckLabel')} note={t('products.createDeckNote')} checked={createDeck} onChange={setCreateDeck} />
      <button type="button" className={styles.cardsToggle} aria-expanded={listOpen} onClick={() => setListOpen((open) => !open)}>
        {t('products.seeCards', { count: product.cardCount })}
        <span aria-hidden="true">{listOpen ? '⌃' : '⌄'}</span>
      </button>
      {listOpen && (
        <ul className={styles.cardList}>
          {product.cards.map((card) => (
            <li key={card.cardIdentifier}>
              {card.quantity}x {cardName(card.name, card.pitch, t)}
            </li>
          ))}
        </ul>
      )}
      <p className={styles.footnote}>{t('products.footnote')}</p>
      {repeatedOn !== null && (
        <p role="alert" className={styles.error}>
          {t('products.repeated', { name: product.name, date })}
        </p>
      )}
      {failed && <p role="alert" className={styles.error}>{t('products.importError')}</p>}
      <button
        type="button"
        className={styles.primary}
        disabled={(!addCards && !createDeck) || importProduct.isPending}
        onClick={() => submit(repeatedOn !== null)}
      >
        {importProduct.isPending ? t('products.adding') : repeatedOn !== null ? t('products.addAnother') : t('products.add')}
      </button>
    </div>
  );
}
