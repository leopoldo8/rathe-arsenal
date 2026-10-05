export const settings = {
  languageHeading: 'Language',
  languageToggleAria: 'Select language',
  // Page heading
  accountSettings: 'Account settings',
  // Profile section
  yourProfile: 'Profile',
  emailAddress: 'Email address',
  // Appearance section
  theme: 'Appearance',
  // Account section
  dangerZone: 'Delete account',
  deleteAccountWarning: 'Deleting your account marks it for permanent removal after 30 days. You are signed out immediately, and your collection, decks and readiness history are erased.',
  deleteMyAccount: 'Delete my account',
  // Admin sync section
  storeCatalogSync: 'Store links sync',
  syncCatalogDesc: "Re-scans the store to find product pages for cards it doesn't link to yet (e.g. after a new set release). Runs in the background via Firecrawl. It does not add new cards to the app: the card list ships with each app update.",
  syncInProgress: 'Sync in progress…',
  syncStoreCatalog: 'Sync store links',
  syncingCatalog: 'Syncing store links… this takes about 20 minutes.',
  syncQueued: 'Queued — the worker will start shortly.',
  lastSync: 'Last sync: {{count}} products · {{when}}',
  neverSynced: 'Never synced.',
  lastSyncFailed: 'The last sync failed at {{when}}: {{reason}}',
  couldNotQueueSync: 'Could not queue the sync. Try again.',
  // delete-account-modal.tsx
  deleteAccountModalTitle: 'Delete your account',
  deleteAccountModalDesc: 'Your account and everything linked to it (collection, decks, readiness history) will be permanently deleted after 30 days. You are signed out immediately.',
  reenterPasswordLabel: 'Re-enter your password',
  deleteAccountAcknowledge: 'I understand my account and all data will be permanently deleted',
  incorrectPassword: 'Incorrect password',
  couldNotDeleteAccount: 'Could not delete your account. Please try again.',
  deleting: 'Deleting…',
  cancel: 'Cancel',
} as const;
