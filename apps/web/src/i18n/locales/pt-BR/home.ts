export const home = {
  // EducationalEmptyState
  welcomeHeading: 'Comece por um deck',
  emptyLead: 'Importe um deck e veja quanto dele a sua coleção já cobre, quais trocas resolvem o resto e o que falta comprar.',
  collectionHintPrefix: 'Você já tem',
  collectionHintCard: 'carta',
  collectionHintCards: 'cartas',
  collectionHintSuffix: 'na sua coleção.',
  howItWorksLabel: 'Como funciona',
  step1Title: 'Importe um deck',
  step1Body: 'Cole o link de um deck do Fabrary.',
  step2Title: 'Veja o que falta',
  step2Body: 'Cruzamos o deck com a sua coleção: o que você tem, o que dá para trocar e o que falta.',
  step3Title: 'Decida as trocas',
  step3Body: 'Aprove ou recuse cada troca sugerida e veja onde comprar o resto.',
  trackFirstDeckCta: 'Importar meu primeiro deck',
  skipToLibrary: 'Ir para a Biblioteca',
  manualAddPrefix: 'Quer só registrar suas cartas?',
  manualAddLinkText: 'Vá para a Biblioteca',
  manualAddSuffix: 'e adicione uma por uma.',

  // AggregateCallout (armory header line)
  aggregateCompletionVerb: 'completaria',
  aggregateDeckConnector: 'de {{total}} decks na',

  // DeckCard
  legalityNotLegalLabel: 'Fora do formato',
  legalityIllegalTitle: 'Fora do formato',
  untrackAriaLabel: 'Excluir {{deckName}}',
  untrackTitle: 'Excluir deck',
  untrackToastMsg: '"{{deckName}}" excluído.',
  undoUntrack: 'Desfazer',

  // PopulatedHomeHero
  collectionStatsLabel: 'Estatísticas da coleção',
  decksStatLabel: 'Decks',
  avgReadyStatLabel: 'Média',
  cardsMissingStatLabel: 'Cartas faltando',
  addNewDeckCta: '+ Novo deck',

  // ReadinessShelves
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
  deckboxOpenAriaLabel: 'Abrir {{deckName}}',

  // ArmoryHeader, FilterBar, StatusGroups, DeckTile
  armoryHeading: 'Seu arsenal',
  readyDecksStatus: '{{ready}} de {{total}} decks prontos para jogar',
  searchPlaceholder: 'Buscar decks ou heróis',
  searchAriaLabel: 'Buscar decks',
  noMatches: 'Nenhum deck corresponde à busca ou aos filtros.',
  metaComplete: 'Completo · {{owned}}/{{total}}',
  metaIncomplete: '{{missing}} faltando · {{owned}}/{{total}}',
  metaDraft: 'Rascunho · sem lista',
  groupActiveName: 'Ativos',
  groupActiveHint: 'Prontos para o jogo',
  groupBuildingName: 'Construindo',
  groupBuildingHint: 'Ainda em ajuste',
  groupIdeaName: 'Ideias',
  groupIdeaHint: 'Sem lista definida',
  groupRetiredName: 'Aposentados',
  groupRetiredHint: 'Fora de uso',
} as const;
