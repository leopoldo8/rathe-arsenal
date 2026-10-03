export const home = {
  // EducationalEmptyState
  welcomeHeading: 'Welcome, Hero.',
  emptyLead:
    'Your armory is empty. Track a deck to see how ready your collection is — we’ll surface owned cards, valid substitutes, and exactly what’s missing.',
  collectionHintPrefix: 'You already have',
  collectionHintCard: 'card',
  collectionHintCards: 'cards',
  collectionHintSuffix: 'in your collection.',
  howItWorksLabel: 'How it works',
  step1Title: 'Paste a deck',
  step1Body: 'From Fabrary, or pick a meta deck we’ve indexed.',
  step2Title: 'See your readiness',
  step2Body:
    'We’ll cross-reference your collection and show what you own, what substitutes are valid, and exactly what’s missing.',
  step3Title: 'Approve & buy',
  step3Body: 'Approve or reject each swap. Shop the missing cards in one click.',
  trackFirstDeckCta: 'Track your first deck',
  skipToLibrary: 'Skip to Library',
  manualAddPrefix: 'Want to add cards without a CSV?',
  manualAddLinkText: 'Go to Library',
  manualAddSuffix: 'to search and add individual cards.',

  // AggregateCallout
  aggregateShoppingLineLabel: 'Aggregate shopping line',
  aggregateCompletionVerb: 'would complete',
  aggregateDeckConnector: 'of {{total}} decks at',

  // DeckCard
  legalityNotLegalLabel: 'Not legal',
  legalityIllegalTitle: 'Illegal',
  untrackAriaLabel: 'Untrack {{deckName}}',
  untrackTitle: 'Untrack',
  untrackToastMsg: '"{{deckName}}" removed from tracking.',
  undoUntrack: 'Undo',

  // PopulatedHomeHero
  collectionStatsLabel: 'Collection statistics',
  decksStatLabel: 'Decks',
  avgReadyStatLabel: 'Avg ready',
  cardsMissingStatLabel: 'Cards missing',
  addNewDeckCta: '+ New deck',

  // ReadinessShelves
  deckCountSingular: '1 deck',
  deckCountPlural: '{{count}} decks',

  // StatusShelves
  retiredExpandAriaLabel: 'Expand retired decks',
  retiredCollapseAriaLabel: 'Collapse retired decks',
  allRetiredEmptyState: 'All your decks are retired.',
  expandToView: 'Expand to view',
  addNewDeckLink: 'Add new deck',

  // TagFilterChips
  filterByTagGroupLabel: 'Filter by tag',
  filterByTagAriaLabel: 'Filter by tag: {{tag}}',
  clearAllTagFiltersAriaLabel: 'Clear all tag filters',
  clearButton: 'Clear',
  tagsLabel: 'Tags',

  // routes/home.tsx — error + loading states
  errorHeading: 'Something went wrong loading your decks',
  retryButton: 'Retry',
  loadingEyebrow: 'Loading eyebrow',
  loadingHeadline: 'Loading headline',
  loadingSummary: 'Loading summary',
  loadingStat: 'Loading stat',
  loadingShelfHeading: 'Loading shelf heading',
  loadingDeckName: 'Loading deck name',
  loadingDeckMeta: 'Loading deck meta',
  loadingReadiness: 'Loading readiness',
  deckboxOpenAriaLabel: 'Open {{deckName}}',

  // ArmoryHeader, FilterBar, StatusGroups, DeckTile
  armoryHeading: 'Your armory',
  readyDecksStatus: '{{ready}} of {{total}} decks ready to play',
  searchPlaceholder: 'Search decks or heroes',
  searchAriaLabel: 'Search decks',
  noMatches: 'No decks match your search or filters.',
  metaComplete: 'Complete · {{owned}}/{{total}}',
  metaIncomplete: '{{missing}} missing · {{owned}}/{{total}}',
  metaDraft: 'Draft · no list',
  groupActiveName: 'Active',
  groupActiveHint: 'Ready to take to a game',
  groupBuildingName: 'Building',
  groupBuildingHint: 'Being assembled, still adjusting',
  groupIdeaName: 'Ideas',
  groupIdeaHint: 'Drafts without a fixed list',
  groupRetiredName: 'Retired',
  groupRetiredHint: 'Kept for reference',
} as const;
