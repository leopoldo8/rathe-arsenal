import { catalog, ICatalogCard } from '@rathe-arsenal/engine';
import {
  deriveGenerationStatus,
  measureElapsedMs,
  medianDurationMs,
  POOL_SAMPLE_SIZE,
  samplePool,
} from '../generation-state';

const NOW = new Date('2026-10-11T12:00:00.000Z');
const secondsFromNow = (seconds: number): Date => new Date(NOW.getTime() + seconds * 1000);

describe('generation state', () => {
  it('derives the status from the run row', () => {
    const rows = [
      { run: { status: 'pending', trigger: 'manual', attempts: 0, runAfter: NOW }, expected: 'queued' },
      { run: { status: 'pending', trigger: 'auto', attempts: 0, runAfter: secondsFromNow(-10) }, expected: 'queued' },
      { run: { status: 'pending', trigger: 'auto', attempts: 0, runAfter: secondsFromNow(300) }, expected: null },
      { run: { status: 'pending', trigger: 'auto', attempts: 1, runAfter: secondsFromNow(60) }, expected: 'retrying' },
      { run: { status: 'pending', trigger: 'manual', attempts: 2, runAfter: secondsFromNow(120) }, expected: 'retrying' },
      { run: { status: 'running', trigger: 'manual', attempts: 1, runAfter: secondsFromNow(-30) }, expected: 'running' },
    ] as const;

    for (const { run, expected } of rows) {
      expect(deriveGenerationStatus(run, NOW)).toBe(expected);
    }
  });

  it('measures elapsed time from the start', () => {
    expect(
      measureElapsedMs({ startedAt: secondsFromNow(-42), createdAt: secondsFromNow(-600), runAfter: secondsFromNow(-60) }, NOW),
    ).toBe(42_000);
    expect(measureElapsedMs({ startedAt: null, createdAt: secondsFromNow(-600), runAfter: secondsFromNow(-15) }, NOW)).toBe(15_000);
    expect(measureElapsedMs({ startedAt: null, createdAt: secondsFromNow(-20), runAfter: secondsFromNow(90) }, NOW)).toBe(0);
  });

  it('typical duration is the median of at least 3 runs', () => {
    expect(medianDurationMs([60_000, 90_000, 300_000])).toBe(90_000);
    expect(medianDurationMs([120_000, 60_000, 100_000, 80_000])).toBe(90_000);
    expect(medianDurationMs([60_000, 90_000])).toBeNull();
    expect(medianDurationMs([])).toBeNull();
  });

  it('samples up to 16 imaged pool cards, the same each time', () => {
    const imaged = catalog.cards.filter((card) => card.imageUrl);
    const withoutImage = { ...imaged[0], cardIdentifier: 'no-image-card', imageUrl: null } as unknown as ICatalogCard;
    const pool = [withoutImage, ...imaged.slice(0, 200)];

    const first = samplePool(pool);
    const second = samplePool([...pool].reverse());

    expect(POOL_SAMPLE_SIZE).toBe(16);
    expect(first).toHaveLength(16);
    expect(new Set(first.map((card) => card.cardIdentifier)).size).toBe(16);
    expect(first.every((card) => card.imageUrl !== null && card.cardIdentifier !== 'no-image-card')).toBe(true);
    expect(first.every((card) => typeof card.name === 'string' && card.name.length > 0)).toBe(true);
    expect(second.map((card) => card.cardIdentifier)).toEqual(first.map((card) => card.cardIdentifier));
    expect(samplePool([withoutImage, ...imaged.slice(0, 5)])).toHaveLength(5);
  });
});
