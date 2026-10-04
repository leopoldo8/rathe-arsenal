export const onboarding = {
  // OnboardingWizard
  wizardAriaLabel: 'Primeiros passos',

  // StepIndicator — nav + items
  stepNavAriaLabel: 'Passo {{current}} de {{total}}',
  stepItemAriaLabel: 'Passo {{number}} de {{total}}: {{label}}, {{state}}',
  stepStateComplete: 'concluído',
  stepStateCurrent: 'atual',
  stepStateUpcoming: 'próximo',
  stepLabel1: 'Importar deck',
  stepLabel2: 'Conferir',
  stepLabel3: 'Trocas',

  // Step 1 — Paste URL
  step1Eyebrow: 'Passo 1 de 3',
  step1Heading: 'Comece por um deck',
  step1Body: 'Cole o link de um deck do Fabrary. Vamos ver quanto dele a sua coleção já cobre.',
  step1Label: 'Link do deck no Fabrary',
  step1Placeholder: 'https://fabrary.net/decks/…',
  step1FormatError: 'Esse não é um link de deck do Fabrary (ex.: https://fabrary.net/decks/…).',
  step1TimeoutError: 'O Fabrary demorou demais para responder. Tente de novo em instantes.',
  step1PrivateDeckError: 'Esse deck é privado no Fabrary. Deixe ele público ou use outro link.',
  step1NotFabError: 'Esse link não parece ser de um deck de Flesh and Blood.',
  step1AlreadyTrackedError: 'Esse deck já está no seu arsenal: {{reason}}',
  step1GenericError: 'Não foi possível importar o deck. Tente de novo.',
  skipForNow: 'Pular',
  continueButton: 'Continuar',

  // Step 2 — Confirm Library
  step2Eyebrow: 'Passo 2 de 3',
  step2Heading: 'Confira o deck',
  step2BodySingle: 'Encontramos seu deck. Confira se está certo antes de calcularmos as trocas.',
  step2BodyMultiple: 'Encontramos {{count}} decks. Confira se estão certos antes de calcularmos as trocas.',
  importedDecksLabel: 'Decks importados',
  backButton: 'Voltar',
  readinessPercent: '{{percent}}% pronto',

  // Step 3 — First Review
  step3Eyebrow: 'Passo 3 de 3',
  step3AlmostHeading: 'Quase pronto…',
  step3AlmostBody: 'O cálculo das trocas está demorando mais que o normal. Pode seguir: seus decks já foram importados e as trocas aparecem em instantes.',
  continueWithoutReview: 'Seguir sem revisar',
  step3ComputingHeading: 'Calculando trocas…',
  step3ComputingBody: 'Cruzando o deck com a sua coleção. É rápido.',
  loadingSubstitutionsLabel: 'Carregando trocas',
  computingSubstitutionsAria: 'Calculando as primeiras trocas…',
  step3LookingGoodHeading: 'Tudo certo',
  step3LookingGoodBody: 'Nenhuma troca pendente: sua coleção cobre este deck.',
  enterArmory: 'Entrar no arsenal',
  step3ReviewHeading: 'Revise as trocas',
  step3ReviewBody: 'Quando falta uma carta, sugerimos outra da sua coleção e explicamos por quê. Recuse as que não servirem: a prontidão do deck se atualiza na hora.',
  substitutionPreviewsLabel: 'Trocas sugeridas',
  approveButton: 'Aprovar',
  rejectButton: 'Recusar',
  approveSubAriaLabel: 'Aprovar troca: {{substitute}} no lugar de {{original}}',
  rejectSubAriaLabel: 'Recusar troca: {{substitute}} no lugar de {{original}}',

  // CongratsAllPlayable
  congratsEyebrow: 'Passo 3 de 3',
  congratsHeading: 'Seu deck está completo!',
  congratsBody: 'Sua coleção já cobre todas as cartas do deck, sem nenhuma troca. Veja o resumo no seu arsenal.',
  goToMyDecks: 'Ir para meus decks',
} as const;
