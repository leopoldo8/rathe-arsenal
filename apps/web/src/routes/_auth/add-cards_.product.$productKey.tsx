import React from 'react';
import { useTranslation } from 'react-i18next';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useProductsQuery } from '../../api/products';
import { ProductConfirm } from '../../components/products/ProductConfirm';
import { Skeleton } from '../../components/ui/Skeleton/Skeleton';
import styles from '../../components/products/Products.module.css';

export const Route = createFileRoute('/_auth/add-cards_/product/$productKey')({
  component: AddCardsProductConfirmPage,
});

export function AddCardsProductConfirmPage(): React.ReactElement {
  const { productKey } = Route.useParams();
  const { t } = useTranslation();
  const products = useProductsQuery('');
  const product = products.data?.products.find((candidate) => candidate.key === productKey);

  if (products.isLoading) return <Skeleton width="100%" height="240px" aria-label={t('common.loadingTitle')} />;
  if (product === undefined) {
    return (
      <div className={styles.page}>
        <Link to="/add-cards/product" className={styles.back}>
          <span aria-hidden="true">‹ </span>
          {t('products.chooseAnother')}
        </Link>
        <p role="alert" className={styles.error}>{t('products.notFound')}</p>
      </div>
    );
  }
  return <ProductConfirm product={product} />;
}
