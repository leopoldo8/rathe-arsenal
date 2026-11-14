import React from 'react';
import { useTranslation } from 'react-i18next';
import { imageFromSmall, useCardLightbox } from './useCardLightbox';
import type { IImageUrl } from './use-lightbox-sources';
import styles from './ZoomableCardImage.module.css';

interface IZoomableCardImageProps {
  /** The small image URL, or the image with its large version; null draws nothing. */
  readonly image: string | IImageUrl | null | undefined;
  /** The card's display name: the button's label and the lightbox title. */
  readonly name: string;
  /** Sizes the image, as the plain `<img>` it replaces did. */
  readonly className?: string | undefined;
  readonly loading?: 'lazy' | 'eager';
}

/** A card thumbnail that opens the card full screen when clicked. */
export function ZoomableCardImage({ image, name, className, loading }: IZoomableCardImageProps): React.ReactElement | null {
  const { t } = useTranslation();
  const lightbox = useCardLightbox();
  if (image === null || image === undefined) return null;
  const full = typeof image === 'string' ? imageFromSmall(image) : image;

  return (
    <>
      <button
        type="button"
        className={styles.button}
        aria-label={t('ui.openFullscreen', { name })}
        data-testid="zoomable-card-image"
        onClick={(event) => lightbox.open(full, name, event.currentTarget)}
      >
        <img className={className} src={full.small} alt="" loading={loading} />
      </button>
      {lightbox.element}
    </>
  );
}
