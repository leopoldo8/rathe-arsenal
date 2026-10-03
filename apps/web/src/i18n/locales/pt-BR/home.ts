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

  // AggregateCallout (armory header line)
  aggregateCompletionVerb: 'completaria',
  aggregateDeckConnector: 'de {{total}} decks na',

  // DeckCard
  legalityNotLegalLabel: 'Não legal',
  legalityIllegalTitle: 'Ilegal',
  untrackAriaLabel: 'Remover rastreamento de {{deckName}}',
  untrackTitle: 'Remover rastreamento',
  untrackToastMsg: '"{{deckName}}" removido do rastreamento.',
  undoUntrack: 'Desfazer',

  // PopulatedHomeHero
  collectionStatsLabel: 'Estatísticas da coleção',
  decksStatLabel: 'Decks',
  avgReadyStatLabel: 'Média',
  cardsMissingStatLabel: 'Faltando',
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
  groupActiveHint: 'Prontos para levar ao jogo',
  groupBuildingName: 'Construindo',
  groupBuildingHint: 'Em montagem, ainda ajustando',
  groupIdeaName: 'Ideias',
  groupIdeaHint: 'Rascunhos sem lista fixa',
  groupRetiredName: 'Aposentados',
  groupRetiredHint: 'Guardados para consulta',
} as const;
