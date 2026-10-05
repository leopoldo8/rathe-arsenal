import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { CardScanner } from '../../components/card-scanner/CardScanner';

export const Route = createFileRoute('/_auth/add-cards_/scan')({
  component: AddCardsScanPage,
});

export function AddCardsScanPage(): React.ReactElement {
  return <CardScanner />;
}
