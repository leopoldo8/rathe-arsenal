import React, { useState } from 'react';
import type { ISharedListLine } from '../../api/shared-lists';
import { CardLightbox } from '../card-art/CardLightbox';
import { CardGalleryCell, type ICardGalleryLightbox } from '../card-gallery/CardGalleryCell';
import { CardGalleryGrid } from '../card-gallery/CardGalleryGrid';

export interface IVisitorCardItem {
  readonly line: ISharedListLine;
  /** Text and controls under the card's name: version, hint, stepper. */
  readonly footer: React.ReactNode;
  /** The visitor chose at least one copy of this line. */
  readonly selected?: boolean;
}

interface IVisitorCardGridProps {
  readonly items: readonly IVisitorCardItem[];
  readonly testId: string;
  readonly formatQuantity: (count: number) => string;
}

/** A visitor's view of a shared list as a card grid, like the library; clicking a card opens it full screen. */
export function VisitorCardGrid({ items, testId, formatQuantity }: IVisitorCardGridProps): React.ReactElement {
  const [lightbox, setLightbox] = useState<ICardGalleryLightbox | null>(null);

  return (
    <>
      <CardGalleryGrid variant="full">
        {items.map(({ line, footer, selected }) => (
          <CardGalleryCell
            key={line.id}
            name={line.name}
            pitch={line.pitch}
            cost={null}
            type={line.type}
            imageUrl={line.imageUrl}
            missing={false}
            quantityLabel={formatQuantity(line.quantity)}
            variant="full"
            testId={testId}
            selected={selected}
            onOpen={setLightbox}
            footer={footer}
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
