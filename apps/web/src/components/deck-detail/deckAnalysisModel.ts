import type { IDeckListItem } from './deckListModel';
import { resolveCostGroup, type TCostGroupId } from './deckListModel';

export type TPitch = 1 | 2 | 3;

export interface IPitchSlice {
  readonly pitch: TPitch;
  readonly count: number;
  readonly percent: number;
}

export interface ICostBar {
  readonly id: Exclude<TCostGroupId, 'none'>;
  readonly count: number;
}

const PITCHES: readonly TPitch[] = [1, 2, 3];
const COST_BAR_ORDER: readonly ICostBar['id'][] = ['0', '1', '2', '3', '4plus'];

export function buildPitchSlices(items: readonly IDeckListItem[]): readonly IPitchSlice[] {
  const counts = PITCHES.map((pitch) =>
    items
      .filter((item) => item.entry.pitch === pitch)
      .reduce((sum, item) => sum + item.quantity, 0),
  );
  const total = counts.reduce((sum, count) => sum + count, 0);
  return PITCHES.map((pitch, index) => {
    const count = counts[index] ?? 0;
    return { pitch, count, percent: total === 0 ? 0 : Math.round((count / total) * 100) };
  });
}

export function buildCostBars(items: readonly IDeckListItem[]): readonly ICostBar[] {
  return COST_BAR_ORDER.map((id) => ({
    id,
    count: items
      .filter((item) => resolveCostGroup(item.entry.cost) === id)
      .reduce((sum, item) => sum + item.quantity, 0),
  }));
}
