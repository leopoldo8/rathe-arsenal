export const variantQueue = {
  // VariantQueueDrawer
  drawerAria: 'Price fetch queue',
  drawerTitle: 'Price fetch queue',
  etaSubtitleFetching: 'Fetching exact prices from Cúpula DT',
  closeQueueAria: 'Close queue',
  noPriceFetches: 'No price fetches running.',
  sectionQueued: 'Queued',
  sectionInProgress: 'In progress',
  sectionRecentlyCompleted: 'Recently completed',
  waitingCount: 'Waiting · {{count}} cards',
  couldNotReachStore: 'Could not reach the store — try again later',
  updatedAndFailed: '{{completed}} updated · {{failed}} failed',
  pricesUpdated: '{{count}} prices updated',
  almostDone: 'almost done',
  secondsLeft: '~{{count}}s left',
  minutesLeft: '~{{count}} min left',

  // VariantQueuePill
  pillActive: 'Price fetch queue — {{count}} in progress',
  pillFailed: 'Price fetch queue — finished with errors',
  pillDone: 'Price fetch queue — done',
} as const;
