import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ProductSearch } from '../../components/products/ProductSearch';

export const Route = createFileRoute('/_auth/add-cards_/product')({
  component: AddCardsProductPage,
});

export function AddCardsProductPage(): React.ReactElement {
  return <ProductSearch />;
}
