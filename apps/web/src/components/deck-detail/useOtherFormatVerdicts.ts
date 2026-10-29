import { useMemo } from 'react';
import { useHeroesQuery } from '../../api/catalog';
import type { IDeckDetailResponse, IDeckDetailSnapshot } from '../../api/deck-detail';
import { buildDraftInitialPayload } from '../../routes/_auth/-deck-detail-draft';
import { computeDraftLegalityInOtherFormats } from '../../lib/draft-legality';
import type { ICompositionDraft } from '../../hooks/useCompositionDraft';
import { hasHeroOutsideFormat, type IOtherFormatVerdict } from './heroOutsideFormatModel';

/** The deck's verdict in the other formats, computed only for a deck whose hero is outside its own. */
export function useOtherFormatVerdicts(
  deck: Pick<IDeckDetailResponse, 'heroIdentifier' | 'format' | 'legality'>,
  snapshot: IDeckDetailSnapshot,
): readonly IOtherFormatVerdict[] {
  const heroes = useHeroesQuery().data?.heroes;
  const heroOutside = hasHeroOutsideFormat(deck.legality.details);

  return useMemo(() => {
    if (!heroOutside) return [];
    const hero = heroes?.find((candidate) => candidate.cardIdentifier === deck.heroIdentifier) ?? null;
    if (hero === null) return [];
    const draft = buildDraftInitialPayload(deck, snapshot) as unknown as ICompositionDraft;
    return computeDraftLegalityInOtherFormats(draft, hero).map((result) => ({
      format: result.format,
      category: result.category,
      details: result.details,
    }));
  }, [heroOutside, heroes, deck, snapshot]);
}
