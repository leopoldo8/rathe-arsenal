import type { IRunFile } from '../lib/types';

export const MINIMUM_PUBLIC_DECKLISTS = 20;

/**
 * Lists public decklists of a hero. No such call exists: `fetchDeck` loads one
 * deck by its id, and Fabrary offers no hero search without a login (plan, open
 * question 4). Until the owner answers that, nothing can be found.
 */
export async function findPublicDecklists(_hero: string): Promise<readonly string[]> {
  return [];
}

export async function runCooccurrence(
  deck: string,
  hero: string,
  find: (hero: string) => Promise<readonly string[]> = findPublicDecklists,
): Promise<IRunFile> {
  const found = (await find(hero)).length;
  if (found < MINIMUM_PUBLIC_DECKLISTS) {
    return { deck, candidate: 'cooccurrence', status: 'untestable', found, minimum: MINIMUM_PUBLIC_DECKLISTS };
  }
  return {
    deck,
    candidate: 'cooccurrence',
    status: 'failed',
    found,
    minimum: MINIMUM_PUBLIC_DECKLISTS,
    error: 'decklists were found but counting them is not built: no source of decklists exists yet',
  };
}
