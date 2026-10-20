import React, { useState } from 'react';
import type { ISharedCard } from '../../api/shared-decks';
import { CardLightbox } from '../card-art/CardLightbox';
import { CardGalleryCell, type ICardGalleryLightbox } from '../card-gallery/CardGalleryCell';
import { CardGalleryGrid } from '../card-gallery/CardGalleryGrid';

function toPitch(pitch: ISharedCard['pitch']): 1 | 2 | 3 | null {
  return pitch === 1 || pitch === 2 || pitch === 3 ? pitch : null;
}

/** What the gallery draws of a card: a deck's card and a list's line both fit. */
export type TSharedGalleryCard = Pick<
  ISharedCard,
  'cardIdentifier' | 'name' | 'pitch' | 'type' | 'quantity'
> & {
  readonly slot?: string;
  readonly imageUrl: React.ComponentProps<typeof CardGalleryCell>['imageUrl'];
};

interface ISharedGalleryProps<TCard extends TSharedGalleryCard> {
  readonly cards: readonly TCard[];
  /** How each card shows its count: `quantity` is the deck's "3×" badge, `missing` the "faltam 3" corner badge. */
  readonly countAs: 'quantity' | 'missing';
  /** Per-card line under the name, e.g. what the visitor owns. */
  readonly noteFor?: ((card: TCard) => React.ReactNode) | undefined;
  /** Drawn over the card's art, e.g. a "sold" stamp. */
  readonly overlayFor?: ((card: TCard) => React.ReactNode) | undefined;
  readonly dimmed?: ((card: TCard) => boolean) | undefined;
  /** Defaults to the card identifier plus its slot; lists need their own, as one card can have several lines. */
  readonly keyFor?: ((card: TCard) => string) | undefined;
  readonly formatQuantity: (count: number) => string;
}

/** Large card images in a grid; clicking one opens it full screen. */
export function SharedGallery<TCard extends TSharedGalleryCard>({
  cards,
  countAs,
  noteFor,
  overlayFor,
  dimmed,
  keyFor = (card) => `${card.cardIdentifier}::${card.slot ?? ''}`,
  formatQuantity,
}: ISharedGalleryProps<TCard>): React.ReactElement {
  const [lightbox, setLightbox] = useState<ICardGalleryLightbox | null>(null);

  return (
    <>
      <CardGalleryGrid variant="full">
        {cards.map((card) => (
          <CardGalleryCell
            key={keyFor(card)}
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
            dimmed={dimmed?.(card)}
            overlay={overlayFor?.(card)}
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
