import React from 'react';
import styles from './CardGallery.module.css';

interface ICardGalleryGridProps {
  readonly variant?: 'crop' | 'full';
  readonly children: React.ReactNode;
}

export function CardGalleryGrid({ variant = 'crop', children }: ICardGalleryGridProps): React.ReactElement {
  return <ul className={variant === 'full' ? `${styles.grid} ${styles.gridFull}` : styles.grid}>{children}</ul>;
}
