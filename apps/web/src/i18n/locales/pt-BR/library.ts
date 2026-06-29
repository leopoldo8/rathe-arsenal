export const library = {
  // LibraryEmptyState
  emptyHeading: 'Sua biblioteca está vazia',
  emptyBody: 'Três maneiras de expandir seu arsenal — escolha a que melhor se encaixa no momento.',
  emptyAddCards: 'Adicionar cards',

  // LibraryStatsBar
  collectionStatisticsLabel: 'Estatísticas da coleção',
  uniqueStatLabel: 'únicas',
  copiesStatLabel: 'cópias',
  pitchBreakdownLabel: 'Distribuição de pitch',
  redPitchTitle: 'Cards de pitch vermelho',
  yellowPitchTitle: 'Cards de pitch amarelo',
  bluePitchTitle: 'Cards de pitch azul',
  colorlessPitchTitle: 'Cards incolores (equipamentos, armas, heróis)',

  // LibrarySearchAddBar
  searchAndAddLabel: 'Buscar e adicionar cards à biblioteca',
  addCardError: 'Falha ao adicionar o card. Tente novamente.',

  // LibraryFilterDrawer + LibraryFilterRail (shared)
  libraryFiltersLabel: 'Filtros da biblioteca',
  filtersHeading: 'Filtros',
  closeFiltersAriaLabel: 'Fechar filtros',

  // LibraryFilterRail — search
  searchLabel: 'Buscar',
  searchPlaceholder: 'Buscar na coleção',
  searchAriaLabel: 'Buscar cards na biblioteca por nome',
  matchingLabel: 'Correspondendo:',

  // LibraryFilterRail — pitch pills
  pitchRedLabel: 'Vermelho',
  pitchYellowLabel: 'Amarelo',
  pitchBlueLabel: 'Azul',
  pitchColorlessLabel: 'Incolor',
  pitchAddToFilter: 'adicionar ao filtro',
  pitchRemoveFromFilter: 'remover do filtro',

  // LibraryFilterRail — toggle sections
  classSectionLabel: 'Classe',
  noClassesHint: 'Nenhuma classe na sua coleção ainda.',
  talentSectionLabel: 'Talento',
  noTalentsHint: 'Nenhum dos seus cards tem um talento ainda.',
  setSectionLabel: 'Set',
  noSetsHint: 'Nenhum set na sua coleção ainda.',

  // LibraryFilterRail — card size
  cardSizeLabel: 'Tamanho dos cards',
  cardSizeAriaLabel: 'Tamanho dos cards em pixels',

  // LibraryFilterRail — group by
  groupByLabel: 'Agrupar por',
  groupTypeLabel: 'Tipo',
  groupPitchLabel: 'Pitch',
  groupSetLabel: 'Set',
  groupFlatLabel: 'Lista',

  // LibraryFilterRail — clear all
  clearAllFilters: 'Limpar todos os filtros',

  // LibraryCardStepper
  removeOneCard: 'Remover um {{name}}',
  addOneCard: 'Adicionar um {{name}}',
  removeFromSourceQuestion: 'Remover 1× de qual fonte? ({{name}})',
  removeOneFrom: 'Remover 1× de',

  // LibraryGrid — card cell
  cardCellAriaLabel: '{{name}}, na coleção: {{qty}}',
  ownedAriaLabel: 'Na coleção: {{qty}}',
  libraryCardsAriaLabel: 'Cards da biblioteca',

  // LibraryGrid — pitch group headings (translated when group=pitch)
  pitchRedGroupLabel: 'Vermelho',
  pitchYellowGroupLabel: 'Amarelo',
  pitchBlueGroupLabel: 'Azul',
  pitchColorlessGroupLabel: 'Incolor',

  // RecentlyAddedBanner
  bannerCardSingular: 'card',
  bannerCardPlural: 'cards',
  bannerAs: 'como',
  bannerVerbFabrary: 'importado do Fabrary',
  bannerVerbCsv: 'importado via CSV',
  bannerVerbAdded: 'adicionado',
  bannerDismissAriaLabel: 'Fechar notificação',

  // Library route — error state
  errorHeading: 'Algo deu errado ao carregar sua biblioteca',
  retryButton: 'Tentar novamente',

  // Library route — header
  collectionEyebrow: 'Sua coleção',
  libraryTitle: 'Biblioteca',
  uniqueEyebrow: 'única',
  copiesEyebrow: 'cópias',

  // Library route — actions
  openFiltersAriaLabel: 'Abrir filtros',
  filtersButton: 'Filtros',
  addCardsLink: 'Adicionar cards',

  // Library route — no results
  noMatchTitle: 'Nenhum card corresponde a esta combinação.',
  clearFiltersButton: 'Limpar filtros',
  estimatedPricesTooltip:
    'Preços estimados a partir de lojas parceiras. Pode ficar defasado quando o scraper não roda por alguns dias.',
} as const;
