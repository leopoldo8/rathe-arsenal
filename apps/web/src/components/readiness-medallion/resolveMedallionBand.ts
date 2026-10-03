export type TMedallionBand = 'ready' | 'accent' | 'building';

export function resolveMedallionBand(pct: number): TMedallionBand {
  if (pct >= 100) return 'ready';
  if (pct >= 85) return 'accent';
  return 'building';
}
