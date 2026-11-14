import React, { useState } from 'react';
import { CardLightbox } from './CardLightbox';
import { lightboxSourcesFor, type IImageUrl } from './use-lightbox-sources';

interface IOpenCard {
  readonly imageUrl: string;
  readonly sources: readonly string[];
  readonly name: string;
  readonly container: Element | null;
}

export interface ICardLightboxControl {
  /**
   * Opens the card full screen; does nothing without an image. `from` is the clicked element:
   * inside a modal dialog the lightbox mounts in that dialog, the only layer that takes clicks.
   */
  readonly open: (imageUrl: IImageUrl | null | undefined, name: string, from?: Element | null) => void;
  /** The lightbox while a card is open, otherwise null; render it anywhere. */
  readonly element: React.ReactElement | null;
}

/** Lightbox state for a screen whose card images open full screen on click. */
export function useCardLightbox(): ICardLightboxControl {
  const [card, setCard] = useState<IOpenCard | null>(null);

  function open(imageUrl: IImageUrl | null | undefined, name: string, from?: Element | null): void {
    if (!imageUrl) return;
    const container = from?.closest('[role="dialog"]') ?? null;
    setCard({ imageUrl: imageUrl.large, sources: lightboxSourcesFor(imageUrl), name, container });
  }

  const element =
    card === null ? null : (
      <CardLightbox imageUrl={card.imageUrl} sources={card.sources} name={card.name} container={card.container} onClose={() => setCard(null)} />
    );
  return { open, element };
}

/**
 * Some answers carry only the small image URL. The CDN keeps the large one beside it
 * (`.../small/<code>.webp` and `.../large/<code>.webp`), with the small one as fallback.
 */
export function imageFromSmall(small: string): IImageUrl {
  const large = small.replace('/small/', '/large/');
  return large === small ? { small, large } : { small, large, sources: [{ small, large }, { small, large: small }] };
}
