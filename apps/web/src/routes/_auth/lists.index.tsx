import { createFileRoute } from '@tanstack/react-router';
import { ListsIndex } from '../../components/lists/ListsIndex';

export const Route = createFileRoute('/_auth/lists/')({
  component: ListsIndex,
});
