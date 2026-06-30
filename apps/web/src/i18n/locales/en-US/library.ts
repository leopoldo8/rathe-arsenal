export const library = {
  // LibraryEmptyState
  emptyHeading: 'Your library is empty',
  emptyBody: 'Three ways to grow your arsenal — pick whichever fits the moment.',
  emptyAddCards: 'Add cards',

  // LibraryStatsBar
  collectionStatisticsLabel: 'Collection statistics',
  uniqueStatLabel: 'unique',
  copiesStatLabel: 'copies',
  pitchBreakdownLabel: 'Pitch breakdown',
  redPitchTitle: 'Red-pitch cards',
  yellowPitchTitle: 'Yellow-pitch cards',
  bluePitchTitle: 'Blue-pitch cards',
  colorlessPitchTitle: 'Colorless cards (equipment, weapons, heroes)',

  // LibrarySearchAddBar
  searchAndAddLabel: 'Search and add cards to your library',
  addCardError: 'Failed to add card. Please try again.',

  // LibraryFilterDrawer + LibraryFilterRail (shared)
  libraryFiltersLabel: 'Library filters',
  filtersHeading: 'Filters',
  closeFiltersAriaLabel: 'Close filters',

  // LibraryFilterRail — search
  searchLabel: 'Search',
  searchPlaceholder: 'Search your collection',
  searchAriaLabel: 'Search the cards in your library by name',
  matchingLabel: 'Matching:',

  // LibraryFilterRail — pitch pills
  pitchRedLabel: 'Red',
  pitchYellowLabel: 'Yellow',
  pitchBlueLabel: 'Blue',
  pitchColorlessLabel: 'Colorless',
  pitchAddToFilter: 'add to filter',
  pitchRemoveFromFilter: 'remove from filter',
  pitchFilterAria: '{{pitch}} pitch — {{action}}',
  pitchNoneLabel: 'No',
  // LibraryGrid — generic fallback group headings (real type/set names stay as data)
  typeOtherGroupLabel: 'Other',
  setUnknownGroupLabel: 'Unknown',

  // LibraryFilterRail — toggle sections
  classSectionLabel: 'Class',
  noClassesHint: 'No classes in your collection yet.',
  talentSectionLabel: 'Talent',
  noTalentsHint: 'None of your cards carry a talent yet.',
  setSectionLabel: 'Set',
  noSetsHint: 'No sets in your collection yet.',

  // LibraryFilterRail — card size
  cardSizeLabel: 'Card size',
  cardSizeAriaLabel: 'Card size in pixels',

  // LibraryFilterRail — group by
  groupByLabel: 'Group by',
  groupTypeLabel: 'Type',
  groupPitchLabel: 'Pitch',
  groupSetLabel: 'Set',
  groupFlatLabel: 'Flat',

  // LibraryFilterRail — clear all
  clearAllFilters: 'Clear all filters',

  // LibraryCardStepper
  removeOneCard: 'Remove one {{name}}',
  addOneCard: 'Add one {{name}}',
  removeFromSourceQuestion: 'Remove 1× from which source? ({{name}})',
  removeOneFrom: 'Remove 1× from',

  // LibraryGrid — card cell
  cardCellAriaLabel: '{{name}}, owned: {{qty}}',
  ownedAriaLabel: 'Owned: {{qty}}',
  libraryCardsAriaLabel: 'Library cards',

  // LibraryGrid — pitch group headings (translated when group=pitch)
  pitchRedGroupLabel: 'Red',
  pitchYellowGroupLabel: 'Yellow',
  pitchBlueGroupLabel: 'Blue',
  pitchColorlessGroupLabel: 'Colorless',

  // RecentlyAddedBanner
  bannerCardSingular: 'card',
  bannerCardPlural: 'cards',
  bannerAs: 'as',
  bannerVerbFabrary: 'imported from Fabrary',
  bannerVerbCsv: 'imported from CSV',
  bannerVerbAdded: 'added',
  bannerDismissAriaLabel: 'Dismiss notification',

  // Library route — error state
  errorHeading: 'Something went wrong loading your library',
  retryButton: 'Retry',

  // Library route — header
  collectionEyebrow: 'Your collection',
  libraryTitle: 'Library',
  uniqueEyebrow: 'unique',
  copiesEyebrow: 'copies',

  // Library route — actions
  openFiltersAriaLabel: 'Open filters',
  filtersButton: 'Filters',
  addCardsLink: 'Add cards',

  // Library route — no results
  noMatchTitle: 'No cards match this combination.',
  clearFiltersButton: 'Clear filters',
  estimatedPricesTooltip:
    "Estimated prices from partner stores. May be stale when the scraper hasn't run for a few days.",
} as const;
