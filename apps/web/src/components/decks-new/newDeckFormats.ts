import { FORMAT_RULES } from '@rathe-arsenal/engine/legality';

export const NEW_DECK_FORMATS: readonly string[] = Object.keys(FORMAT_RULES);

export const FORMAT_LINE_KEY: Readonly<Record<string, string>> = {
  'Classic Constructed': 'decks.newDeckFormatClassicConstructed',
  Blitz: 'decks.newDeckFormatBlitz',
  'Living Legend': 'decks.newDeckFormatLivingLegend',
  'Silver Age': 'decks.newDeckFormatSilverAge',
};

export function supportedFormatsOf(legalFormats: readonly string[]): readonly string[] {
  return NEW_DECK_FORMATS.filter((format) => legalFormats.includes(format));
}
