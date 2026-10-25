import type { TTranslationResources } from '../pt-BR';

export const products: TTranslationResources['products'] = {
  back: 'Add cards',
  searchTitle: 'Which deck did you buy?',
  searchSubtitle: 'Armory Deck, Blitz Deck or Silver Age.',
  searchAria: 'Search the deck by product or hero name',
  loadError: 'We could not load the decks. Try again.',
  noResults: 'No deck found.',
  notFound: 'We did not find that deck.',

  chooseAnother: 'Choose another',
  confirmTitle_zero: '{{name}} · {{count}} cards',
  confirmTitle_one: '{{name}} · {{count}} card',
  confirmTitle_other: '{{name}} · {{count}} cards',
  addCardsLabel_zero: 'Put the {{count}} cards in my collection',
  addCardsLabel_one: 'Put the {{count}} card in my collection',
  addCardsLabel_other: 'Put the {{count}} cards in my collection',
  addCardsNote: 'You bought the box, so these cards are yours.',
  createDeckLabel: 'Create a deck with them',
  createDeckNote: 'To see if the deck is complete and what is worth buying later.',
  seeCards_zero: 'See the {{count}} cards',
  seeCards_one: 'See the {{count}} card',
  seeCards_other: 'See the {{count}} cards',
  footnote:
    'The cards come in with the version that ships in the box, foils included. Agility and Might are game markers, not deck cards, and stay out.',
  add: 'Add',
  adding: 'Adding…',
  repeated: 'You already added {{name}} on {{date}}. Add another box?',
  addAnother: 'Add another box',
  importError: 'We could not add it. Try again.',
};
