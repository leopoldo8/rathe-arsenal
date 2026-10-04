export const home = {
  // EducationalEmptyState
  welcomeHeading: 'Start with a deck',
  emptyLead: 'Import a deck and see how much of it your collection already covers, which swaps fill the rest, and what is left to buy.',
  collectionHintPrefix: 'You already have',
  collectionHintCard: 'card',
  collectionHintCards: 'cards',
  collectionHintSuffix: 'in your collection.',
  howItWorksLabel: 'How it works',
  step1Title: 'Import a deck',
  step1Body: 'Paste a Fabrary deck link.',
  step2Title: 'See what\'s missing',
  step2Body: 'We match the deck against your collection: what you own, what can be swapped, and what\'s missing.',
  step3Title: 'Decide on swaps',
  step3Body: 'Approve or reject each suggested swap and see where to buy the rest.',
  trackFirstDeckCta: 'Import my first deck',
  skipToLibrary: 'Skip to Library',
  manualAddPrefix: 'Want to add cards without a CSV?',
  manualAddLinkText: 'Go to Library',
  manualAddSuffix: 'to search and add individual cards.',

  // AggregateCallout (armory header line)
  aggregateCompletionVerb: 'would complete',
  aggregateDeckConnector: 'of {{total}} decks at',

  // DeckCard
  legalityNotLegalLabel: 'Off format',
  legalityIllegalTitle: 'Off format',
  untrackAriaLabel: 'Delete {{deckName}}',
  untrackTitle: 'Delete deck',
  untrackToastMsg: '"{{deckName}}" deleted.',
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
  armoryHeading: 'Your arsenal',
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
