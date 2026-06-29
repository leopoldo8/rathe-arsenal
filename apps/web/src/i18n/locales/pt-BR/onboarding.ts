export const onboarding = {
  // OnboardingWizard
  wizardAriaLabel: 'Assistente de integração',

  // StepIndicator — nav + items
  stepNavAriaLabel: 'Passo {{current}} de {{total}}',
  stepItemAriaLabel: 'Passo {{number}} de {{total}}: {{label}}, {{state}}',
  stepStateComplete: 'concluído',
  stepStateCurrent: 'atual',
  stepStateUpcoming: 'próximo',
  stepLabel1: 'Colar deck',
  stepLabel2: 'Confirmar biblioteca',
  stepLabel3: 'Revisar substituições',

  // Step 1 — Paste URL
  step1Eyebrow: 'Passo 1 de 3',
  step1Heading: 'Primeiro, um deck',
  step1Body:
    'Cole qualquer URL de deck do Fabrary. Vamos usá-la para entender o que você quer jogar e o quão pronta está sua coleção.',
  step1Label: 'URL de deck do Fabrary',
  step1Placeholder: 'https://fabrary.net/decks/…',
  step1FormatError:
    'Deve ser uma URL válida de deck do Fabrary (ex: https://fabrary.net/decks/…)',
  step1TimeoutError:
    'Essa URL demorou muito para responder — o deck pode ser inacessível ou o servidor está indisponível.',
  step1PrivateDeckError:
    'Esse deck está definido como privado no Fabrary. Torne-o público ou use uma URL diferente.',
  step1NotFabError: 'Essa URL não parece ser um deck de Flesh and Blood.',
  step1AlreadyTrackedError: 'Deck já rastreado: {{reason}}',
  step1GenericError: 'Falha ao importar deck. Tente novamente.',
  skipForNow: 'Pular por agora',
  continueButton: 'Continuar',

  // Step 2 — Confirm Library
  step2Eyebrow: 'Passo 2 de 3',
  step2Heading: 'Sua biblioteca',
  step2BodySingle:
    'Encontramos seu deck. Confirme se está correto antes de calcularmos as substituições.',
  step2BodyMultiple:
    'Encontramos {{count}} decks. Confirme se estão corretos antes de calcularmos as substituições.',
  importedDecksLabel: 'Decks importados',
  backButton: 'Voltar',
  readinessPercent: '{{percent}}% pronto',

  // Step 3 — First Review
  step3Eyebrow: 'Passo 3 de 3',
  step3AlmostHeading: 'Quase pronto…',
  step3AlmostBody:
    'O cálculo das substituições está demorando mais que o esperado. Você pode continuar — seus decks já estão rastreados e estarão prontos em breve.',
  continueWithoutReview: 'Continuar sem revisar',
  step3ComputingHeading: 'Calculando substituições…',
  step3ComputingBody:
    'Estamos analisando sua coleção em relação ao deck. Isso leva apenas um momento.',
  loadingSubstitutionsLabel: 'Carregando substituições',
  computingSubstitutionsAria: 'Calculando suas primeiras substituições…',
  step3LookingGoodHeading: 'Parece ótimo!',
  step3LookingGoodBody:
    'Nenhuma substituição pendente encontrada. Sua coleção cobre bem este deck.',
  enterArmory: 'Entrar no arsenal',
  step3ReviewHeading: 'As substituições são honestas',
  step3ReviewBody:
    'Quando um card está faltando, propomos uma troca pontuada por tier com uma justificativa. Você pode rejeitar qualquer uma delas — a prontidão é atualizada instantaneamente.',
  substitutionPreviewsLabel: 'Pré-visualização de substituições',
  approveButton: 'Aprovar',
  rejectButton: 'Rejeitar',
  approveSubAriaLabel: 'Aprovar substituição: {{substitute}} por {{original}}',
  rejectSubAriaLabel: 'Rejeitar substituição: {{substitute}} por {{original}}',

  // CongratsAllPlayable
  congratsEyebrow: 'Passo 3 de 3',
  congratsHeading: 'Você está completamente jogável!',
  congratsBody:
    'Incrível — sua coleção já cobre tudo no seu deck. Sem substituições necessárias. Vá ao seu arsenal para ver o resumo completo.',
  goToMyDecks: 'Ir para meus decks',
} as const;
