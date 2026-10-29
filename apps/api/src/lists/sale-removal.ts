import { ICopyVersion, isUnversioned, sameVersion } from '../collection/versions/copy-version';

export interface ISaleHeldCopy extends ICopyVersion {
  readonly sourceId: string;
  readonly quantity: number;
}

export interface ISaleRemovedCopy extends ICopyVersion {
  readonly sourceId: string;
  readonly quantity: number;
}

export interface ISaleRemovalPlan {
  readonly removed: readonly ISaleRemovedCopy[];
  readonly total: number;
}

function takeFrom(
  candidates: readonly ISaleHeldCopy[],
  wanted: number,
): { readonly taken: ISaleRemovedCopy[]; readonly left: number } {
  const taken: ISaleRemovedCopy[] = [];
  let left = wanted;
  for (const copy of candidates) {
    if (left === 0) break;
    const quantity = Math.min(copy.quantity, left);
    if (quantity === 0) continue;
    const { sourceId, printingCode, edition, finish, condition } = copy;
    taken.push({ sourceId, printingCode, edition, finish, condition, quantity });
    left -= quantity;
  }
  return { taken, left };
}

/**
 * Which copies leave the collection when `sold` copies of a version are sold: copies of the same version first,
 * then copies with no version. Another version is never touched, and a sale of more copies than the collection
 * holds removes only what it holds.
 */
export function planSaleRemoval(copies: readonly ISaleHeldCopy[], version: ICopyVersion, sold: number): ISaleRemovalPlan {
  const sameVersionCopies = copies.filter((copy) => sameVersion(copy, version));
  const first = takeFrom(sameVersionCopies, sold);
  const unversioned = isUnversioned(version) ? [] : copies.filter((copy) => isUnversioned(copy));
  const second = takeFrom(unversioned, first.left);
  const removed = [...first.taken, ...second.taken];
  return { removed, total: removed.reduce((sum, copy) => sum + copy.quantity, 0) };
}
