export const csvSources = {
  // CsvSourcesEmptyState
  emptyAriaLabel: 'No CSV sources',
  emptyHeading: 'No CSVs imported yet',
  emptyBody: 'Upload your first CSV to seed your library from a collection you already have. Duplicates across sources are summed, not overwritten.',
  emptyUploadAriaLabel: 'Upload a CSV to import your collection',
  emptyUploadButton: 'Upload CSV',

  // UploadCsvButton
  uploadAriaLabel: 'Upload CSV file',
  uploadButtonLabel: 'Upload CSV',
  uploadingLabel: 'Uploading {{filename}}…',
  uploadSuccessToast: 'CSV imported successfully.',
  uploadErrorDefault: 'Upload failed. Please try again.',
  fileSizeError: 'File too large — maximum size is 2 MB.',
  fileInputAriaLabel: 'Select CSV file to upload',
  onTriggerAriaLabel: 'Upload a CSV to import your collection',

  // SumExplainer
  sumExplainerTrigger: 'How duplicate cards are handled',
  sumExplainerBodyPre: 'Cards that appear in multiple CSV sources are',
  sumExplainerBodyHighlight: 'summed',
  sumExplainerBodyPost: ', not overwritten. Your total owned copies reflect the combined quantities across all active sources.',
  sumExplainerFootnote: 'To avoid double-counting physical cards you own, deactivate sources you no longer need rather than deleting them.',
  sumExplainerDiagramAriaLabel: 'Sum diagram: Source A + Source B = Total',

  // CsvSourceList
  csvSourcesListAriaLabel: 'CSV sources',

  // CsvSourceRow
  toggleAriaLabel: 'Toggle "{{label}}" active',
  renameAriaLabel: 'Rename "{{label}}"',
  renameTitle: 'Click to rename',
  editSourceNameAriaLabel: 'Edit source name',
  optionsAriaLabel: 'Options for "{{label}}"',
  renameMenuItem: 'Rename',
  deleteMenuItem: 'Delete',
  cardSingular: 'card',
  cardPlural: 'cards',
  updateSourceError: 'Failed to update source. Changes reverted.',
  renameSourceError: 'Failed to rename source.',

  // DeleteSourceModal
  deleteModalTitle: 'Delete "{{label}}"?',
  deleteModalDescription: 'This action is permanent and cannot be undone.',
  deletePreviewError: 'Failed to load impact preview. Please try again.',
  deletePreviewSummaryPrefix: 'Deleting this source will remove',
  deletePreviewSummarySuffix: 'from your library.',
  deletePreviewDecksWarning: '{{count}} deck(s) will drop in readiness.',
  affectedDecksAriaLabel: 'Affected decks',
  deletingMessagePrefix: 'Removing source and recomputing readiness across',
  deletingMessageSuffix: '…',
  confirmInputLabelPre: 'Type',
  confirmInputLabelPost: 'to confirm',
  confirmInputSrOnlyHint: 'Type the word DELETE in uppercase to enable the confirm button.',
  cancelButton: 'Cancel',
  deleteSourceButton: 'Delete source',
  deletingButton: 'Deleting…',
  deleteSuccessToast: '"{{label}}" deleted.',
  deleteWarningToast: 'Source deleted. Readiness numbers may be stale — refresh to recompute.',
  deleteErrorToast: 'Failed to delete source. Please try again.',

  // UploadResolveModal — skipped rows variant
  skippedRowsTitleSingular: '{{n}} row could not be matched',
  skippedRowsTitlePlural: '{{n}} rows could not be matched',
  skippedRowsDescription: 'The import completed, but the following rows could not be resolved to catalog cards.',
  unresolvedRowsAriaLabel: 'Unresolved rows',
  rowLabel: 'Row {{n}}',
  closeButton: 'Close',

  // UploadResolveModal — exact match variant
  exactMatchTitle: 'This file is already imported',
  exactMatchDescription: 'You already have a source with the same cards. What would you like to do?',
  cancelButton2: 'Cancel',
  replaceExistingButton: 'Replace existing',
  importAsSeparateCopyButton: 'Import as separate copy',

  // UploadResolveModal — partial overlap variant
  partialOverlapTitle: 'Update existing source?',
  deltaNoChanges: 'No changes detected.',
  deltaChangeSummaryAriaLabel: 'Change summary',
  deltaNewCards: 'New cards',
  deltaIncreased: 'Increased',
  deltaDecreased: 'Decreased',
  deltaRemoved: 'Removed',
  cancelButton3: 'Cancel',
  replaceWithNewButton: 'Replace with new',
  updateExistingButton: 'Update existing',

  // SkipReasonLabel
  skipReasonNoMatch: 'Card not found in catalog',
  skipReasonAmbiguous: 'Multiple cards match — no set column to disambiguate',
  skipReasonInvalidQuantity: 'Invalid quantity (must be a positive integer)',
  skipReasonEmptyName: 'Empty card name',

  // Library CSV sources route
  csvSourcesBackLink: '← Add cards · CSV',
  csvSourcesEyebrow: 'Imports management',
  csvSourcesTitle: 'Library sources',
  csvSourcesSubtitle: "Each source is a snapshot of cards you've imported — toggle one off to remove its contribution from your library without losing the file. Manual entries and Fabrary imports show up here too.",
  csvSourcesViewLibraryLink: '→ View library',
  csvSourcesErrorBanner: 'Failed to load library sources.',
  csvSourcesRetryButton: 'Retry',

  // Add cards CSV route
  addCsvBackLink: '← Add cards',
  addCsvEyebrow: 'CSV import',
  addCsvTitle: 'Import a CSV',
  addCsvSubtitle: 'Drop a Fabrary or compatible CSV — name + quantity columns are required; set and pitch are optional.',
  addCsvDropZoneAriaLabel: 'CSV drop zone',
  addCsvUploadingLabel: 'Uploading {{filename}}…',
  addCsvDropTitle: 'Drop a CSV here, or click to choose a file.',
  addCsvDragOverTitle: 'Release to upload.',
  addCsvDropHint: 'Up to 2 MB. Each upload becomes a new toggleable source.',
  addCsvChooseFile: 'Choose a file',
  addCsvErrorTitle: 'Upload failed',
  addCsvTryAnotherFile: 'Try another file',
  addCsvManageLink: '→ Manage existing CSV sources',
} as const;
