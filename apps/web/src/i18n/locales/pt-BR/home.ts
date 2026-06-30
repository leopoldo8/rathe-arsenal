export const home = {
  // EducationalEmptyState
  welcomeHeading: 'Bem-vindo, Herói.',
  emptyLead:
    'Seu arsenal está vazio. Adicione um deck para ver o quão pronta está sua coleção — vamos destacar os cards que você tem, substitutos válidos e exatamente o que está faltando.',
  collectionHintPrefix: 'Você já tem',
  collectionHintCard: 'card',
  collectionHintCards: 'cards',
  collectionHintSuffix: 'na sua coleção.',
  howItWorksLabel: 'Como funciona',
  step1Title: 'Cole um deck',
  step1Body: 'Do Fabrary, ou escolha um deck meta que indexamos.',
  step2Title: 'Veja sua prontidão',
  step2Body:
    'Vamos cruzar sua coleção e mostrar o que você tem, substitutos válidos e exatamente o que está faltando.',
  step3Title: 'Aprovar e comprar',
  step3Body: 'Aprove ou rejeite cada troca. Compre os cards faltando com um clique.',
  trackFirstDeckCta: 'Rastrear seu primeiro deck',
  skipToLibrary: 'Ir para a Biblioteca',
  manualAddPrefix: 'Quer adicionar cards sem um CSV?',
  manualAddLinkText: 'Vá para a Biblioteca',
  manualAddSuffix: 'para buscar e adicionar cards individuais.',

  // AggregateCallout
  aggregateShoppingLineLabel: 'Resumo de compra',
  aggregateCompletionVerb: 'completaria',
  aggregateDeckConnector: 'de {{total}} decks na',

  // DeckCard
  untrackConfirmMsg:
    'Remover "{{deckName}}" do rastreamento? Isso irá remover o deck e todos os seus dados de prontidão.',
  legalityLegalLabel: 'Legal',
  legalityNotLegalLabel: 'Não legal',
  legalityLegalTitle: 'Legal',
  legalityIncompleteTitle: 'Incompleto',
  legalityIllegalTitle: 'Ilegal',
  tagsRowLabel: 'Tags',
  moreTagsAriaLabel: '{{count}} tags a mais',
  noReadinessData: 'Sem dados de prontidão',
  untrackAriaLabel: 'Remover rastreamento de {{deckName}}',
  untrackTitle: 'Remover rastreamento',
  readinessMeterAriaLabel: 'Prontidão {{display}}%, {{tier}}',
  untrackToastMsg: '"{{deckName}}" removido do rastreamento.',
  undoUntrack: 'Desfazer',

  // PopulatedHomeHero
  armoryEyebrow: 'Seu arsenal',
  yourDecksHeading: 'Seus Decks',
  summaryReady: '{{count}} prontos para jogar',
  summaryAlmost: '{{count}} quase lá',
  summaryNeeds: '{{count}} para montar',
  collectionStatsLabel: 'Estatísticas da coleção',
  decksStatLabel: 'Decks',
  avgReadyStatLabel: 'Média pronto',
  cardsMissingStatLabel: 'Cards faltando',
  addNewDeckCta: 'Adicionar novo deck',

  // ReadinessShelves
  readyShelfLabel: 'Pronto para jogar',
  almostShelfLabel: 'Quase lá',
  needsShelfLabel: 'Precisa de coleção',
  deckCountSingular: '1 deck',
  deckCountPlural: '{{count}} decks',

  // StatusShelves
  retiredExpandAriaLabel: 'Expandir decks aposentados',
  retiredCollapseAriaLabel: 'Recolher decks aposentados',
  allRetiredEmptyState: 'Todos os seus decks estão aposentados.',
  expandToView: 'Expandir para ver',
  addNewDeckLink: 'Adicionar novo deck',

  // TagFilterChips
  filterByTagGroupLabel: 'Filtrar por tag',
  filterByTagAriaLabel: 'Filtrar por tag: {{tag}}',
  clearAllTagFiltersAriaLabel: 'Limpar todos os filtros de tag',
  clearButton: 'Limpar',
  tagsLabel: 'Tags',

  // routes/home.tsx — error + loading states
  errorHeading: 'Erro ao carregar seus decks',
  retryButton: 'Tentar novamente',
  loadingEyebrow: 'Carregando cabeçalho',
  loadingHeadline: 'Carregando título',
  loadingSummary: 'Carregando resumo',
  loadingStat: 'Carregando estatística',
  loadingShelfHeading: 'Carregando título da estante',
  loadingDeckName: 'Carregando nome do deck',
  loadingDeckMeta: 'Carregando meta do deck',
  loadingReadiness: 'Carregando prontidão',
} as const;
