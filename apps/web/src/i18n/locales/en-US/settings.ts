export const settings = {
  languageEyebrow: 'Language',
  languageHeading: 'Interface language',
  languageLabel: 'Language',
  languageToggleAria: 'Select language',
  // Page heading
  accountSettings: 'Account settings',
  // Profile section
  profileEyebrow: 'Profile',
  yourProfile: 'Your profile',
  emailAddress: 'Email address',
  // Appearance section
  appearanceEyebrow: 'Appearance',
  theme: 'Theme',
  colorTheme: 'Color theme',
  // Account section
  accountEyebrow: 'Account',
  dangerZone: 'Danger zone',
  deleteAccountWarning: 'Deleting your account marks it for permanent removal after 30 days. You will be signed out immediately and your collection, tracked decks, and readiness history will be erased.',
  deleteMyAccount: 'Delete my account',
  // Admin sync section
  adminEyebrow: 'Admin',
  storeCatalogSync: 'Store catalog sync',
  syncCatalogDesc: "Re-scans the store to discover new cards' product pages (e.g. after a new set release). Runs in the background via Firecrawl — trigger it once when a set drops.",
  syncInProgress: 'Sync in progress…',
  syncStoreCatalog: 'Sync store catalog',
  syncingCatalog: 'Syncing catalog… this takes a few minutes.',
  syncQueued: 'Queued — the worker will start shortly.',
  lastSync: 'Last sync: {{count}} products · {{when}}',
  neverSynced: 'Never synced.',
  couldNotQueueSync: 'Could not queue the sync. Try again.',
  // delete-account-modal.tsx
  deleteAccountModalTitle: 'Delete your account',
  deleteAccountModalDesc: 'Your account and all linked data (collection, tracked decks, readiness history) will be permanently deleted after 30 days. You will be signed out immediately.',
  reenterPasswordLabel: 'Re-enter your password',
  deleteAccountAcknowledge: 'I understand my account and all data will be permanently deleted',
  incorrectPassword: 'Incorrect password',
  couldNotDeleteAccount: 'Could not delete your account. Please try again.',
  deleting: 'Deleting…',
  cancel: 'Cancel',
} as const;
