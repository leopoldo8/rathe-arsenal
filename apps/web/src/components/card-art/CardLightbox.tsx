import React, { useCallback, useEffect, useRef, useState } from 'react';
import styles from './CardLightbox.module.css';

export interface ICardLightboxProps {
  /** Large-size WebP URL for the card face. */
  readonly imageUrl: string;
  /** Card name — used as dialog title + img alt. */
  readonly name: string;
  /** Called when user dismisses via Escape, backdrop, or close button. */
  readonly onClose: () => void;
}

/**
 * Fullscreen card preview with perspective tilt on mouse-move.
 *
 * Dismisses on Escape, backdrop click, or the explicit close button.
 * Respects `prefers-reduced-motion` — the tilt collapses to a static
 * card when the user has motion reduced (R56 parity).
 */
export function CardLightbox({
  imageUrl,
  name,
  onClose,
}: ICardLightboxProps): React.ReactElement {
  const [tilt, setTilt] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useRef<boolean>(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Capture reduced-motion preference once. We intentionally do NOT
    // subscribe to changes — the preview is short-lived and the current
    // value at open time is what matters for the perceived motion.
    prefersReducedMotion.current = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
  }, []);

  // Escape-to-close. Kept in a ref-free effect so the handler always
  // reads the latest onClose without re-subscribing per render.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    // Focus the close button so keyboard users can immediately dismiss
    // without tabbing through the overlay.
    closeButtonRef.current?.focus();
    // Lock body scroll while the lightbox is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (prefersReducedMotion.current) return;
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // Normalize pointer to [-1, 1] on each axis relative to the card
    // centerpoint. Max tilt magnitude of 12deg reads as a strong but
    // non-disorienting parallax — more and the image warps past recognition.
    const normX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const normY = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    setTilt({ x: normY * -12, y: normX * 12 });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTilt({ x: 0, y: 0 });
  }, []);

  const cardStyle: React.CSSProperties = {
    transform: `perspective(1200px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
  };

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label={name}
      onClick={onClose}
      data-testid="card-lightbox-backdrop"
    >
      <button
        type="button"
        ref={closeButtonRef}
        className={styles.closeButton}
        onClick={onClose}
        aria-label="Close fullscreen preview"
        data-testid="card-lightbox-close"
      >
        &#10005;
      </button>
      <div
        ref={cardRef}
        className={styles.card}
        style={cardStyle}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={(e) => e.stopPropagation()}
        data-testid="card-lightbox-card"
      >
        {!loaded && !errored && (
          <div
            className={styles.skeleton}
            role="status"
            aria-label={`Loading ${name}`}
            data-testid="card-lightbox-skeleton"
          />
        )}
        {errored && (
          // Graceful fallback for LSS S3 misses: the image code didn't
          // resolve to a real asset (404, network, CORS). Keep the
          // container intact and communicate the state instead of
          // looping the skeleton forever.
          <div
            className={styles.errorState}
            role="alert"
            data-testid="card-lightbox-error"
          >
            <span className={styles.errorGlyph} aria-hidden="true">&#9670;</span>
            <span className={styles.errorTitle}>Card art unavailable</span>
            <span className={styles.errorBody}>{name}</span>
          </div>
        )}
        {!errored && (
          <img
            src={imageUrl}
            alt={name}
            className={styles.image}
            onLoad={() => setLoaded(true)}
            onError={() => setErrored(true)}
            data-testid="card-lightbox-image"
            style={{ opacity: loaded ? 1 : 0 }}
          />
        )}
      </div>
      <p className={styles.caption} aria-hidden="true">
        {name}
      </p>
    </div>
  );
}
