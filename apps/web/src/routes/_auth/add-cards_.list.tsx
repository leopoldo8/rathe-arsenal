import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ListReader } from '../../components/collection-reader/ListReader';

export const Route = createFileRoute('/_auth/add-cards_/list')({
  component: AddCardsListPage,
});

export function AddCardsListPage(): React.ReactElement {
  return <ListReader />;
}
