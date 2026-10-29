/**
 * Where "Ver na LigaFAB" sends the seller. LigaFAB cannot be read by a script (its robots file and challenge page forbid
 * it), so the app only links to the site's search page and the seller checks the price by hand. The address format was
 * not verified from here (open question 5 of the persona-rethink plan): change this one constant if it is wrong.
 */
export const LIGAFAB_SEARCH_URL = 'https://www.ligafab.com.br/?view=cards/search&card=';

export function ligaFabUrl(cardName: string): string {
  return `${LIGAFAB_SEARCH_URL}${encodeURIComponent(cardName)}`;
}
