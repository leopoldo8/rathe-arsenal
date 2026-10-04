export const library = {
  // LibraryEmptyState
  emptyHeading: 'Sua biblioteca está vazia',
  emptyBody: 'Adicione as cartas que você tem: uma a uma, por CSV ou a partir de um deck do Fabrary.',
  emptyAddCards: 'Adicionar cartas',

  // LibraryStatsBar
  collectionStatisticsLabel: 'Estatísticas da coleção',
  uniqueStatLabel: 'únicas',
  copiesStatLabel: 'cópias',
  pitchBreakdownLabel: 'Distribuição de pitch',
  redPitchTitle: 'Cartas de pitch vermelho',
  yellowPitchTitle: 'Cartas de pitch amarelo',
  bluePitchTitle: 'Cartas de pitch azul',
  colorlessPitchTitle: 'Cartas sem pitch (equipamentos, armas, heróis)',


  // LibraryFilterDrawer + LibraryFilterRail (shared)
  libraryFiltersLabel: 'Filtros da biblioteca',
  filtersHeading: 'Filtros',
  closeFiltersAriaLabel: 'Fechar filtros',

  // LibraryFilterRail — search
  searchLabel: 'Buscar',
  searchPlaceholder: 'Buscar na coleção',
  searchAriaLabel: 'Buscar cartas na biblioteca pelo nome',
  matchingLabel: 'Resultados:',

  // LibraryFilterRail — pitch pills
  pitchRedLabel: 'Vermelho',
  pitchYellowLabel: 'Amarelo',
  pitchBlueLabel: 'Azul',
  pitchColorlessLabel: 'Sem cor',
  pitchAddToFilter: 'adicionar ao filtro',
  pitchRemoveFromFilter: 'remover do filtro',
  pitchFilterAria: 'Pitch {{pitch}}: {{action}}',
  pitchNoneLabel: 'Sem',
  // LibraryGrid — generic fallback group headings (real type/set names stay as data)
  typeOtherGroupLabel: 'Outros',
  setUnknownGroupLabel: 'Desconhecido',

  // LibraryFilterRail — toggle sections
  classSectionLabel: 'Classe',
  noClassesHint: 'Nenhuma classe na sua coleção ainda.',
  talentSectionLabel: 'Talento',
  noTalentsHint: 'Nenhuma das suas cartas tem talento.',
  setSectionLabel: 'Set',
  noSetsHint: 'Nenhum set na sua coleção ainda.',

  // LibraryFilterRail — card size
  cardSizeLabel: 'Tamanho das cartas',
  cardSizeAriaLabel: 'Tamanho das cartas',
  cardSizeSmall: 'Pequeno',
  cardSizeMedium: 'Médio',
  cardSizeLarge: 'Grande',
  cardSizeXLarge: 'Extra grande',
  cardSizeMax: 'Máximo',
  cardSizeCustom: 'Personalizado',
  manageSourcesLink: 'Gerenciar fontes',

  // LibraryFilterRail — group by
  groupByLabel: 'Agrupar por',
  groupTypeLabel: 'Tipo',
  groupPitchLabel: 'Pitch',
  groupSetLabel: 'Set',
  groupFlatLabel: 'Lista',

  // LibraryFilterRail — clear all
  clearAllFilters: 'Limpar todos os filtros',

  // LibraryCardStepper
  removeOneCard: 'Remover uma cópia de {{name}}',
  addOneCard: 'Adicionar uma cópia de {{name}}',
  removeFromSourceQuestion: 'De qual fonte remover 1 cópia de {{name}}?',
  removeOneFrom: 'Remover 1 de',

  // LibraryGrid — card cell
  cardCellAriaLabel: '{{name}}, na coleção: {{qty}}',
  ownedAriaLabel: 'Na coleção: {{qty}}',
  libraryCardsAriaLabel: 'Cartas da biblioteca',

  // LibraryGrid — pitch group headings (translated when group=pitch)
  pitchRedGroupLabel: 'Vermelho',
  pitchYellowGroupLabel: 'Amarelo',
  pitchBlueGroupLabel: 'Azul',
  pitchColorlessGroupLabel: 'Sem cor',

  // RecentlyAddedBanner
  bannerCardSingular: 'carta',
  bannerCardPlural: 'cartas',
  bannerAs: 'como',
  bannerVerbFabrary_one: 'importada do Fabrary',
  bannerVerbFabrary_other: 'importadas do Fabrary',
  bannerVerbCsv_one: 'importada por CSV',
  bannerVerbCsv_other: 'importadas por CSV',
  bannerVerbAdded_one: 'adicionada',
  bannerVerbAdded_other: 'adicionadas',
  bannerDismissAriaLabel: 'Fechar notificação',

  // Library route — error state
  errorHeading: 'Não foi possível carregar sua biblioteca',
  retryButton: 'Tentar novamente',

  // Library route — header
  collectionEyebrow: 'Sua coleção',
  libraryTitle: 'Biblioteca',
  uniqueEyebrow: 'única',
  copiesEyebrow: 'cópias',

  // Library route — actions
  openFiltersAriaLabel: 'Abrir filtros',
  filtersButton: 'Filtros',
  addCardsLink: 'Adicionar cartas',

  // Library route — no results
  noMatchTitle: 'Nenhuma carta com esses filtros.',
  clearFiltersButton: 'Limpar filtros',
  priceFreshnessNone: 'Sem dados de preço',
  priceFreshnessDays_one: 'Atualizado há {{count}} dia',
  priceFreshnessDays_other: 'Atualizado há {{count}} dias',
  estimatedPricesTooltip: 'Preços estimados a partir das lojas parceiras. Podem estar defasados se a atualização não rodar por alguns dias.',
} as const;
