import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { useProductsQuery } from '../../api/products';
import styles from './Products.module.css';

/** "Qual deck você comprou?": the ready-made decks with a stored decklist, found by product or hero name. */
export function ProductSearch(): React.ReactElement {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const products = useProductsQuery(query.trim());
  const list = products.data?.products ?? [];

  return (
    <div className={styles.page}>
      <Link to="/add-cards" className={styles.back}>
        <span aria-hidden="true">‹ </span>
        {t('products.back')}
      </Link>
      <h1 className={styles.title}>{t('products.searchTitle')}</h1>
      <p className={styles.subtitle}>{t('products.searchSubtitle')}</p>
      <input
        type="search"
        className={styles.search}
        value={query}
        aria-label={t('products.searchAria')}
        onChange={(event) => setQuery(event.target.value)}
      />
      {products.isError && <p role="alert" className={styles.error}>{t('products.loadError')}</p>}
      {products.isSuccess && list.length === 0 && <p className={styles.empty}>{t('products.noResults')}</p>}
      <ul className={styles.results}>
        {list.map((product) => (
          <li key={product.key}>
            <Link to="/add-cards/product/$productKey" params={{ productKey: product.key }} className={styles.result}>
              {product.hero.imageUrl === null ? (
                <span className={styles.thumb} aria-hidden="true" />
              ) : (
                <img className={styles.thumb} src={product.hero.imageUrl.small} alt="" loading="lazy" />
              )}
              <span>
                <span className={styles.productName}>{product.name}</span>
                <span className={styles.formatLabel}>{product.format}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
