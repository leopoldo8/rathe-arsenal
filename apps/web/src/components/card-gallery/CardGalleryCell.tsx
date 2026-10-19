import React from 'react';
import { CardArt, type ICardArtProps } from '../card-art/CardArt';
import { lightboxSourcesFor } from '../card-art/use-lightbox-sources';
import styles from './CardGallery.module.css';

export interface ICardGalleryLightbox {
  readonly imageUrl: string;
  readonly sources: readonly string[];
  readonly name: string;
}

interface ICardGalleryCellProps {
  readonly name: string;
  readonly pitch: 1 | 2 | 3 | null;
  readonly cost: number | null;
  readonly type: string;
  readonly imageUrl: ICardArtProps['imageUrl'];
  /** Hatches the art; the "still to acquire" corner badge is `missingCount`. */
  readonly missing: boolean;
  readonly missingCount?: number | undefined;
  /** Badge in the top-left corner of the art, e.g. "3×". */
  readonly quantityLabel?: string | undefined;
  /** `crop` shows the illustration window of the card; `full` shows the whole card, larger. */
  readonly variant?: 'crop' | 'full';
  readonly onOpen: (lightbox: ICardGalleryLightbox) => void;
  /** Rendered under the name: a note, a status chip, controls. */
  readonly footer?: React.ReactNode;
  readonly testId?: string;
  readonly quantityTestId?: string;
  readonly dataMissing?: boolean | undefined;
}

/** One card of a gallery: art (click opens the lightbox), quantity badge and name. */
export function CardGalleryCell({
  name,
  pitch,
  cost,
  type,
  imageUrl,
  missing,
  missingCount,
  quantityLabel,
  variant = 'crop',
  onOpen,
  footer,
  testId,
  quantityTestId,
  dataMissing,
}: ICardGalleryCellProps): React.ReactElement {
  const cellClass = [styles.cell, dataMissing === true ? styles.cellMissing : ''].filter(Boolean).join(' ');
  const thumbClass = variant === 'full' ? `${styles.thumb} ${styles.thumbFull}` : styles.thumb;

  return (
    <li className={cellClass} data-testid={testId} data-missing={dataMissing}>
      <div className={thumbClass}>
        <CardArt
          name={name}
          pitch={pitch}
          cost={cost}
          type={type}
          missing={missing}
          missingCount={missingCount}
          size="lg"
          imageUrl={imageUrl}
          onClick={
            imageUrl
              ? () => onOpen({ imageUrl: imageUrl.large, sources: lightboxSourcesFor(imageUrl), name })
              : undefined
          }
        />
        {quantityLabel !== undefined && (
          <span className={styles.qtyBadge} data-testid={quantityTestId}>
            {quantityLabel}
          </span>
        )}
      </div>
      <span className={styles.name} title={name}>
        {name}
      </span>
      {footer}
    </li>
  );
}
