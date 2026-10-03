import { useMemo } from 'react';
import { useHeroesQuery } from '../../api/catalog';
import type { IHeroArt } from '../readiness-medallion/ReadinessMedallion';

export interface IDeckHero {
  readonly name: string;
  readonly art: IHeroArt | null;
}

export function useDeckHero(heroIdentifier: string | null, fallbackName: string): IDeckHero {
  const heroesQuery = useHeroesQuery();
  const heroCard = useMemo(
    () =>
      heroIdentifier
        ? (heroesQuery.data?.heroes.find((h) => h.cardIdentifier === heroIdentifier) ?? null)
        : null,
    [heroIdentifier, heroesQuery.data],
  );

  return useMemo(() => {
    const image = heroCard?.imageUrl ?? null;
    const sources = image ? image.sources.map((source) => source.small) : [];
    const smallSources = sources.length > 0 ? sources : image ? [image.small] : [];
    return {
      name: heroCard?.name ?? fallbackName,
      art: image ? { small: image.small, smallSources } : null,
    };
  }, [heroCard, fallbackName]);
}
