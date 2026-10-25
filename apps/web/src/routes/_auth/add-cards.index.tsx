import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { AddCardsEntry } from '../../components/add-cards/AddCardsEntry';

export const Route = createFileRoute('/_auth/add-cards/')({
  component: AddCardsIndexPage,
});

export function AddCardsIndexPage(): React.ReactElement {
  return <AddCardsEntry />;
}
