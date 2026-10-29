import type { TFunction } from 'i18next';

/**
 * "da Bia" or "do Pedro": the app does not know the owner's gender, so a name ending in "a" takes
 * the feminine form, which fits the common Brazilian names. English has one form for both.
 */
export function ofOwner(t: TFunction, owner: string): string {
  const feminine = /a$/i.test(owner.trim());
  return t(feminine ? 'account.ofOwnerFeminine' : 'account.ofOwnerMasculine', { owner });
}
