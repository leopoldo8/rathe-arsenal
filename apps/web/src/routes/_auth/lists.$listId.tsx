import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ListEditor } from '../../components/lists/ListEditor';

export const Route = createFileRoute('/_auth/lists/$listId')({
  component: ListEditorPage,
});

function ListEditorPage(): React.ReactElement {
  const { listId } = Route.useParams();
  return <ListEditor listId={listId} />;
}
