export const onboarding = {
  // OnboardingWizard
  wizardAriaLabel: 'Getting started',

  // StepIndicator — nav + items
  stepNavAriaLabel: 'Step {{current}} of {{total}}',
  stepItemAriaLabel: 'Step {{number}} of {{total}}: {{label}}, {{state}}',
  stepStateComplete: 'complete',
  stepStateCurrent: 'current',
  stepStateUpcoming: 'upcoming',
  stepLabel1: 'Paste deck',
  stepLabel2: 'Confirm library',
  stepLabel3: 'Review subs',

  // Step 1 — Paste URL
  step1Eyebrow: 'Step 1 of 3',
  step1Heading: 'First, a deck',
  step1Body:
    'Paste any Fabrary deck URL. We will use it to understand what you want to play and how ready your collection is.',
  step1Label: 'Fabrary deck URL',
  step1Placeholder: 'https://fabrary.net/decks/…',
  step1FormatError: 'Must be a valid Fabrary deck URL (e.g. https://fabrary.net/decks/…)',
  step1TimeoutError:
    'That URL took too long to respond — the deck may be unreachable or the server is unavailable.',
  step1PrivateDeckError:
    'That deck is set to private on Fabrary. Make it public or use a different URL.',
  step1NotFabError: 'That URL does not appear to be a Flesh and Blood deck.',
  step1AlreadyTrackedError: 'This deck is already in your arsenal: {{reason}}',
  step1GenericError: 'Failed to import deck. Please try again.',
  skipForNow: 'Skip for now',
  continueButton: 'Continue',

  // Step 2 — Confirm Library
  step2Eyebrow: 'Step 2 of 3',
  step2Heading: 'Now, your collection',
  step2BodySingle:
    'We found your deck. Confirm it looks right before we compute substitutions.',
  step2BodyMultiple:
    'We found {{count}} decks. Confirm they look right before we compute substitutions.',
  importedDecksLabel: 'Imported decks',
  backButton: 'Back',
  readinessPercent: '{{percent}}% ready',

  // Step 3 — First Review
  step3Eyebrow: 'Step 3 of 3',
  step3AlmostHeading: 'Almost ready…',
  step3AlmostBody: 'Computing swaps is taking longer than usual. You can continue: your decks are already imported and the swaps will show up shortly.',
  continueWithoutReview: 'Continue without review',
  step3ComputingHeading: 'Computing substitutions…',
  step3ComputingBody:
    'We are analysing your collection against the deck. This only takes a moment.',
  loadingSubstitutionsLabel: 'Loading substitutions',
  computingSubstitutionsAria: 'Computing your first substitutions…',
  step3LookingGoodHeading: 'Looking good!',
  step3LookingGoodBody:
    'No pending substitutions found. Your collection covers this deck well.',
  enterArmory: 'Go to my arsenal',
  step3ReviewHeading: 'Review the swaps',
  step3ReviewBody: 'When a card is missing, we suggest another one from your collection and explain why. Reject any that don\'t fit: the deck\'s readiness updates right away.',
  substitutionPreviewsLabel: 'Substitution previews',
  approveButton: 'Approve',
  rejectButton: 'Reject',
  approveSubAriaLabel: 'Approve substitution: {{substitute}} for {{original}}',
  rejectSubAriaLabel: 'Reject substitution: {{substitute}} for {{original}}',

  // CongratsAllPlayable
  congratsEyebrow: 'Step 3 of 3',
  congratsHeading: 'Your deck is complete!',
  congratsBody: 'Your collection already covers every card in the deck, with no swaps. See the summary in your arsenal.',
  goToMyDecks: 'Go to my decks',
} as const;
