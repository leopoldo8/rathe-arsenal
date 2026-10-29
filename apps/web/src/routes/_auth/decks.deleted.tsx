import { createFileRoute } from '@tanstack/react-router';
import { DeletedDecksPage } from '../../components/deleted-decks/DeletedDecksPage';

export const Route = createFileRoute('/_auth/decks/deleted')({
  component: DeletedDecksPage,
});

export { DeletedDecksPage };
