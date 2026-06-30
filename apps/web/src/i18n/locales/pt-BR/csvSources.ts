export const csvSources = {
  // CsvSourcesEmptyState
  emptyAriaLabel: 'Nenhuma fonte CSV',
  emptyHeading: 'Nenhum CSV importado ainda',
  emptyBody: 'Faça upload do seu primeiro CSV para popular sua biblioteca a partir de uma coleção que você já tem. Duplicatas entre fontes são somadas, não substituídas.',
  emptyUploadAriaLabel: 'Fazer upload de um CSV para importar sua coleção',
  emptyUploadButton: 'Upload CSV',

  // UploadCsvButton
  uploadAriaLabel: 'Upload de arquivo CSV',
  uploadButtonLabel: 'Upload CSV',
  uploadingLabel: 'Enviando {{filename}}…',
  uploadSuccessToast: 'CSV importado com sucesso.',
  uploadErrorDefault: 'Upload falhou. Tente novamente.',
  fileSizeError: 'Arquivo muito grande — tamanho máximo é 2 MB.',
  fileInputAriaLabel: 'Selecionar arquivo CSV para upload',
  onTriggerAriaLabel: 'Fazer upload de um CSV para importar sua coleção',

  // SumExplainer
  sumExplainerTrigger: 'Como cards duplicados são tratados',
  sumExplainerBodyPre: 'Cards que aparecem em múltiplas fontes CSV são',
  sumExplainerBodyHighlight: 'somados',
  sumExplainerBodyPost: ', não substituídos. Suas cópias totais refletem as quantidades combinadas de todas as fontes ativas.',
  sumExplainerFootnote: 'Para evitar contagem dupla de cards físicos que você possui, desative as fontes que não são mais necessárias em vez de excluí-las.',
  sumExplainerDiagramAriaLabel: 'Diagrama de soma: Fonte A + Fonte B = Total',

  // CsvSourceList
  csvSourcesListAriaLabel: 'Fontes CSV',

  // CsvSourceRow
  toggleAriaLabel: 'Alternar "{{label}}" ativo',
  renameAriaLabel: 'Renomear "{{label}}"',
  renameTitle: 'Clique para renomear',
  editSourceNameAriaLabel: 'Editar nome da fonte',
  optionsAriaLabel: 'Opções para "{{label}}"',
  renameMenuItem: 'Renomear',
  deleteMenuItem: 'Excluir',
  cardSingular: 'card',
  cardPlural: 'cards',
  updateSourceError: 'Falha ao atualizar a fonte. Alterações revertidas.',
  renameSourceError: 'Falha ao renomear a fonte.',

  // DeleteSourceModal
  deleteModalTitle: 'Excluir "{{label}}"?',
  deleteModalDescription: 'Esta ação é permanente e não pode ser desfeita.',
  deletePreviewError: 'Falha ao carregar o preview de impacto. Tente novamente.',
  deletePreviewSummaryPrefix: 'Excluir esta fonte vai remover',
  deletePreviewSummarySuffix: 'da sua biblioteca.',
  deletePreviewDecksWarning: '{{count}} deck(s) vão cair em prontidão.',
  affectedDecksAriaLabel: 'Decks afetados',
  deletingMessagePrefix: 'Removendo fonte e recalculando prontidão de',
  deletingMessageSuffix: '…',
  confirmInputLabelPre: 'Digite',
  confirmInputLabelPost: 'para confirmar',
  // residual sweep: inline plural nouns + diagram labels + csv upload errors
  cardsNoun_one: 'carta',
  cardsNoun_other: 'cartas',
  decksNoun_one: 'baralho',
  decksNoun_other: 'baralhos',
  readyLabel: '{{pct}}% pronto',
  sumExplainerSourceA: 'Fonte A',
  sumExplainerSourceB: 'Fonte B',
  sumExplainerTotal: 'Total',
  csvOverSizeLimit: 'O arquivo excede o limite de 2 MB ({{size}} MB).',
  csvUnexpectedResult: 'Resultado de upload inesperado: {{kind}}',
  csvUploadFailed: 'Falha no upload.',
  uploadFailedWithError: 'Falha no upload: {{error}}',
  confirmInputSrOnlyHint: 'Digite a palavra DELETE em maiúsculas para habilitar o botão de confirmação.',
  cancelButton: 'Cancelar',
  deleteSourceButton: 'Excluir fonte',
  deletingButton: 'Excluindo…',
  deleteSuccessToast: '"{{label}}" excluído.',
  deleteWarningToast: 'Fonte excluída. Números de prontidão podem estar desatualizados — atualize para recalcular.',
  deleteErrorToast: 'Falha ao excluir a fonte. Tente novamente.',

  // UploadResolveModal — skipped rows variant
  skippedRowsTitleSingular: '{{n}} linha não pôde ser mapeada',
  skippedRowsTitlePlural: '{{n}} linhas não puderam ser mapeadas',
  skippedRowsDescription: 'A importação foi concluída, mas as seguintes linhas não puderam ser resolvidas para cards do catálogo.',
  unresolvedRowsAriaLabel: 'Linhas não resolvidas',
  rowLabel: 'Linha {{n}}',
  closeButton: 'Fechar',

  // UploadResolveModal — exact match variant
  exactMatchTitle: 'Este arquivo já foi importado',
  exactMatchDescription: 'Você já tem uma fonte com os mesmos cards. O que você gostaria de fazer?',
  cancelButton2: 'Cancelar',
  replaceExistingButton: 'Substituir existente',
  importAsSeparateCopyButton: 'Importar como cópia separada',

  // UploadResolveModal — partial overlap variant
  partialOverlapTitle: 'Atualizar fonte existente?',
  deltaNoChanges: 'Nenhuma alteração detectada.',
  deltaChangeSummaryAriaLabel: 'Resumo de alterações',
  deltaNewCards: 'Novos cards',
  deltaIncreased: 'Aumentado',
  deltaDecreased: 'Diminuído',
  deltaRemoved: 'Removido',
  cancelButton3: 'Cancelar',
  replaceWithNewButton: 'Substituir com novo',
  updateExistingButton: 'Atualizar existente',

  // SkipReasonLabel
  skipReasonNoMatch: 'Card não encontrado no catálogo',
  skipReasonAmbiguous: 'Múltiplos cards correspondem — sem coluna de set para desambiguar',
  skipReasonInvalidQuantity: 'Quantidade inválida (deve ser um inteiro positivo)',
  skipReasonEmptyName: 'Nome do card vazio',

  // Library CSV sources route
  csvSourcesBackLink: 'Adicionar cards',
  csvSourcesEyebrow: 'Gerenciamento de importações',
  csvSourcesTitle: 'Fontes da biblioteca',
  csvSourcesSubtitle: 'Cada fonte é um snapshot dos cards que você importou — desative para remover sua contribuição da biblioteca sem perder o arquivo. Entradas manuais e importações do Fabrary também aparecem aqui.',
  csvSourcesViewLibraryLink: '→ Ver biblioteca',
  csvSourcesErrorBanner: 'Falha ao carregar as fontes da biblioteca.',
  csvSourcesRetryButton: 'Tentar novamente',

  // Add cards CSV route
  addCsvBackLink: '← Adicionar cards',
  addCsvEyebrow: 'Importação CSV',
  addCsvTitle: 'Importar um CSV',
  addCsvSubtitle: 'Solte um CSV do Fabrary ou compatível — colunas de nome + quantidade são obrigatórias; set e pitch são opcionais.',
  addCsvDropZoneAriaLabel: 'Zona de drop de CSV',
  addCsvUploadingLabel: 'Enviando {{filename}}…',
  addCsvDropTitle: 'Solte um CSV aqui, ou clique para escolher um arquivo.',
  addCsvDragOverTitle: 'Solte para fazer o upload.',
  addCsvDropHint: 'Até 2 MB. Cada upload se torna uma nova fonte alternável.',
  addCsvChooseFile: 'Escolher arquivo',
  addCsvErrorTitle: 'Upload falhou',
  addCsvTryAnotherFile: 'Tentar outro arquivo',
  addCsvManageLink: '→ Gerenciar fontes da biblioteca',
} as const;
