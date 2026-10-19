import React, { useState } from 'react';
import type { ISharedCard } from '../../api/shared-decks';
import { CardLightbox } from '../card-art/CardLightbox';
import { CardGalleryCell, type ICardGalleryLightbox } from '../card-gallery/CardGalleryCell';
import { CardGalleryGrid } from '../card-gallery/CardGalleryGrid';

function toPitch(pitch: ISharedCard['pitch']): 1 | 2 | 3 | null {
  return pitch === 1 || pitch === 2 || pitch === 3 ? pitch : null;
}

interface ISharedGalleryProps {
  readonly cards: readonly ISharedCard[];
  /** How each card shows its count: `quantity` is the deck's "3×" badge, `missing` the "faltam 3" corner badge. */
  readonly countAs: 'quantity' | 'missing';
  /** Per-card line under the name, e.g. what the visitor owns. */
  readonly noteFor?: ((card: ISharedCard) => React.ReactNode) | undefined;
  readonly formatQuantity: (count: number) => string;
}

/** Large card images in a grid; clicking one opens it full screen. */
export function SharedGallery({ cards, countAs, noteFor, formatQuantity }: ISharedGalleryProps): React.ReactElement {
  const [lightbox, setLightbox] = useState<ICardGalleryLightbox | null>(null);

  return (
    <>
      <CardGalleryGrid variant="full">
        {cards.map((card) => (
          <CardGalleryCell
            key={`${card.cardIdentifier}::${card.slot}`}
            name={card.name}
            pitch={toPitch(card.pitch)}
            cost={null}
            type={card.type}
            imageUrl={card.imageUrl}
            missing={false}
            missingCount={countAs === 'missing' ? card.quantity : undefined}
            quantityLabel={countAs === 'quantity' ? formatQuantity(card.quantity) : undefined}
            variant="full"
            testId="shared-card"
            onOpen={setLightbox}
            footer={noteFor?.(card)}
          />
        ))}
      </CardGalleryGrid>
      {lightbox && (
        <CardLightbox
          imageUrl={lightbox.imageUrl}
          sources={lightbox.sources}
          name={lightbox.name}
          onClose={() => setLightbox(null)}
        />
      )}
    </>
  );
}
