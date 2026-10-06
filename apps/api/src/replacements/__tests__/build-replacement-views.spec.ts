import { CardReplacementEntity } from '../../database/entities/card-replacement.entity';
import { buildReplacementViews } from '../build-replacement-views';

function replacement(overrides: Partial<CardReplacementEntity>): CardReplacementEntity {
  return {
    id: 'r',
    slot: 'mainboard',
    originalCardIdentifier: 'flex-red',
    replacementCardIdentifier: 'adrenaline-rush-red',
    quantity: 2,
    pickedFrom: 'close',
    status: 'active',
    ...overrides,
  } as CardReplacementEntity;
}

describe('buildReplacementViews', () => {
  it('never prompts for an adopted recommendation', () => {
    const owned = new Map([['flex-red', 4]]);

    const views = buildReplacementViews(
      [replacement({ id: 'adopted', pickedFrom: 'recommendation' }), replacement({ id: 'picked', pickedFrom: 'close' })],
      owned,
      [],
      (id) => id,
    );

    expect(views.map((view) => [view.id, view.originalOwned])).toEqual([
      ['adopted', false],
      ['picked', true],
    ]);
  });
});
