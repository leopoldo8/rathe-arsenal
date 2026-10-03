import React from 'react';
import styles from './Deckbox.module.css';

interface IDeckboxSceneProps {
  readonly zIndex: 1 | 2 | 3;
  readonly className?: string | undefined;
  readonly children: React.ReactNode;
}

/**
 * The only place that emits a scene wrapping a shared box transform. The
 * three layers must stay separate siblings at different z-indexes: the cards
 * sit between the back wall and the front wall, which is what makes them
 * read as inside the box.
 */
export function DeckboxScene({
  zIndex,
  className,
  children,
}: IDeckboxSceneProps): React.ReactElement {
  const sceneClass = [styles.scene, styles[`scene--z${zIndex}`], className]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={sceneClass} data-scene-z={zIndex}>
      <div className={styles.box}>{children}</div>
    </div>
  );
}
