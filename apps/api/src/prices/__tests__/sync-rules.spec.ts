import { shouldReadGroup } from '../sync-rules';

const LAST_UPDATED = new Date('2026-10-18T20:05:21Z');

describe('shouldReadGroup', () => {
  it('reads a group that was never read', () => {
    expect(shouldReadGroup(null, LAST_UPDATED, new Date('2026-10-18T21:00:00Z'))).toBe(true);
  });

  it('reads when tcgcsv rebuilt after the last read, on a later UTC day', () => {
    expect(shouldReadGroup(new Date('2026-10-17T21:00:00Z'), LAST_UPDATED, new Date('2026-10-18T21:00:00Z'))).toBe(true);
  });

  it('never reads twice in the same UTC day, even if tcgcsv rebuilt since', () => {
    expect(shouldReadGroup(new Date('2026-10-18T19:00:00Z'), LAST_UPDATED, new Date('2026-10-18T21:00:00Z'))).toBe(false);
  });

  it('does not read when tcgcsv has not rebuilt since the last read', () => {
    expect(shouldReadGroup(new Date('2026-10-18T21:00:00Z'), LAST_UPDATED, new Date('2026-10-19T09:00:00Z'))).toBe(false);
  });

  it('counts the UTC day, not the local one', () => {
    expect(shouldReadGroup(new Date('2026-10-18T23:59:00Z'), new Date('2026-10-19T00:30:00Z'), new Date('2026-10-19T00:40:00Z'))).toBe(true);
  });
});
