import { ICopyVersion } from '../../collection/versions/copy-version';
import { planSaleRemoval, ISaleHeldCopy } from '../sale-removal';

const VERSION: ICopyVersion = { printingCode: 'HP1001', edition: '', finish: '', condition: 'NM' };
const NONE: ICopyVersion = { printingCode: '', edition: '', finish: '', condition: '' };
const LIGHTLY_PLAYED: ICopyVersion = { ...VERSION, condition: 'LP' };

function held(sourceId: string, version: ICopyVersion, quantity: number): ISaleHeldCopy {
  return { sourceId, ...version, quantity };
}

describe('planSaleRemoval', () => {
  it('takes the same version first, then copies with no version', () => {
    const copies = [held('a', NONE, 3), held('a', VERSION, 1), held('a', LIGHTLY_PLAYED, 5)];

    const plan = planSaleRemoval(copies, VERSION, 3);

    expect(plan.removed).toEqual([
      { sourceId: 'a', ...VERSION, quantity: 1 },
      { sourceId: 'a', ...NONE, quantity: 2 },
    ]);
    expect(plan.total).toBe(3);
  });

  it('takes copies with no version only when the line itself names no version', () => {
    const plan = planSaleRemoval([held('a', NONE, 4), held('a', VERSION, 2)], NONE, 3);

    expect(plan.removed).toEqual([{ sourceId: 'a', ...NONE, quantity: 3 }]);
  });

  it('removes only what the collection holds', () => {
    const plan = planSaleRemoval([held('a', VERSION, 1)], VERSION, 2);

    expect(plan.removed).toEqual([{ sourceId: 'a', ...VERSION, quantity: 1 }]);
    expect(plan.total).toBe(1);
  });

  it('takes nothing when the collection holds no matching copy', () => {
    const plan = planSaleRemoval([held('a', LIGHTLY_PLAYED, 4)], VERSION, 2);

    expect(plan.removed).toEqual([]);
    expect(plan.total).toBe(0);
  });

  it('draws across imports in the order they are given', () => {
    const plan = planSaleRemoval([held('a', VERSION, 1), held('b', VERSION, 2)], VERSION, 3);

    expect(plan.removed).toEqual([
      { sourceId: 'a', ...VERSION, quantity: 1 },
      { sourceId: 'b', ...VERSION, quantity: 2 },
    ]);
  });
});
